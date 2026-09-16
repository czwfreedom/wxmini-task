import { Err } from '../constant/error';
import { Context } from '../core/context';
import { Entity } from '../model/entity';
import { Comment } from '../server/comment';
import { Config } from '../server/config';
import { Relation } from '../server/relation';
import { Media, Resource } from '../server/resource';
import { Routine } from '../server/routine';
import { User } from '../server/user';
import { AvatarUtils } from '../utils/avatarUtils';
import { DateUtils } from '../utils/dateUtils';
import { Logger } from '../utils/logger';
import { OSSUtils } from '../utils/ossUtils';
import { VoiceUtils } from '../utils/voiceUtils';
import { RoutineUI } from './routineUI';

export class RoutineAdapter {
  protected infos: Routine.Info[] = [];
  public updateable = false;
  public addable = false;
  public finishable = false;
  public isToday = false;
  public date = 0;
  public userId = Context.getUserId();

  public template?: Config.Template;

  protected comments: Map<string, Comment.ListResponse> = new Map();
  protected relations?: Relation.ListResponse;
  protected relationStat?: Relation.Stat;

  /**
   * 任务 id → 该任务的媒体【源数据】（Media）。
   *
   * ★ 源数据由 adapter 持有：routine 列表只返回 mediaRemark（id 串），
   *   可播放/可展示的地址需 Resource.list 查询后在此缓存。
   *   UI 层（RoutineUI）需要源数据时统一向 adapter 要，不可从 VM 反推。
   */
  protected mediaMap: Map<string, Media[]> = new Map();

  /**
   * 用户 id → 用户信息。
   *
   * ★ 来源是 Routine.list 返回的 users 字段（与 Relation.list 同构），
   *   不是 User 接口 —— User 只有单条 listInfo，逐条查会变成 N+1。
   *   用途：委托任务的署名行（需要对方昵称与头像色）。
   */
  protected users: Map<string, User.Info> = new Map();

  /** 取某任务的媒体【源数据】 */
  public getMedias(id: string): Media[] {
    return this.mediaMap.get(id) || [];
  }

  /** 取某任务的音频【源数据】（供 AudiosUI 播放） */
  public getAudios(id: string): Media[] {
    return this.getMedias(id).filter((o) => o.type === Resource.Type.Audio);
  }

  /** 取某任务的图片【源数据】（供预览） */
  public getImages(id: string): Media[] {
    return this.getMedias(id).filter((o) => o.type === Resource.Type.Image);
  }

  /**
   * 同步媒体【源数据】，使其与 infos 的 mediaRemark **严格对应**（内容与顺序都要一致）。
   *
   * 每次调用都会比对（无缓存短路），因为任务可能在【其他页面】被修改：
   * 别的页面加了图/音频、删了某张、或调整了顺序 —— 都要在这里对齐。
   *
   * 处理逻辑：
   *   ① 解析每个任务 mediaRemark 期望的 id 序列（顺序敏感）
   *   ② 与 mediaMap 现有序列逐位比对：
   *        · 某 id 在缓存中查不到 → 记为「欠资源」，统一拉取
   *        · 长度或任一位不同   → 记为「需重排」
   *   ③ 只拉真正缺失的 id（已有资源不重复请求）
   *   ④ 按 mediaRemark 顺序重建 mediaMap —— 顺序差异与增删都在此被修正
   *
   * @returns 错误码；拉取失败时返回错误码（调用方可忽略，不阻断页面）
   */
  public async loadMedias(): Promise<number> {
    // ① 已缓存的 Media 索引（跨任务收集，避免重复拉取同一资源）
    const indexed = new Map<string, Media>();
    this.mediaMap.forEach((list) => {
      for (const media of list) {
        if (media.id) indexed.set(media.id, media);
      }
    });

    // ② 解析期望序列，同时找出「欠资源」与「需重排」
    const expected = new Map<string, string[]>(); // 任务 id → 期望的媒体 id 序列
    const missing: string[] = []; // 缓存中查不到的 id（去重）
    let needRebuild = false;

    for (const info of this.infos) {
      const ids = RoutineAdapter.parseMediaIds(info.mediaRemark);
      expected.set(info.id, ids);

      const current = this.mediaMap.get(info.id) || [];
      if (current.length !== ids.length) {
        // 数量变了：别的页面增删过媒体
        needRebuild = true;
      } else {
        for (let i = 0; i < ids.length; i++) {
          if (current[i].id !== ids[i]) {
            // 顺序变了
            needRebuild = true;
            break;
          }
        }
      }

      for (const id of ids) {
        if (!indexed.has(id) && !missing.includes(id)) missing.push(id);
      }
    }

    // ③ 只拉缺失的资源
    if (missing.length) {
      const res = await Resource.list({ ids: missing });
      if (typeof res === 'number') {
        Logger.warn('List resources failed.', res);
        return res;
      }
      for (const media of res) {
        indexed.set(media.id, media);
      }
      needRebuild = true;
    }

    // ④ 重建：严格按 mediaRemark 顺序（顺序差异、增删都在此修正）
    if (needRebuild) {
      const rebuilt = new Map<string, Media[]>();
      expected.forEach((ids, infoId) => {
        const medias: Media[] = [];
        for (const id of ids) {
          const media = indexed.get(id);
          // 拉取失败的 id 直接跳过，保证 medias 与 id 序列位置对齐
          if (media) medias.push(media);
        }
        if (medias.length) rebuilt.set(infoId, medias);
      });
      this.mediaMap = rebuilt;
    }
    return Err.Code.OK;
  }

  /** 解析 mediaRemark（逗号分隔的 id 串）为 id 数组，去空白与空项 */
  protected static parseMediaIds(mediaRemark?: string): string[] {
    if (!mediaRemark) return [];
    const ids: string[] = [];
    for (const raw of mediaRemark.split(',')) {
      const id = raw.trim();
      if (id) ids.push(id);
    }
    return ids;
  }

  /**
   * 媒体【源数据】→ 渲染用 VM（图片 / 音频分开）。
   * 图片用 OSS 缩略图地址，音频带时长文本与语音条宽度。
   */
  protected adaptMedias(info: Routine.Info): { images: Entity.Image[]; audios: Entity.Image[] } {
    const images: Entity.Image[] = [];
    const audios: Entity.Image[] = [];

    for (const media of this.getMedias(info.id)) {
      if (media.type === Resource.Type.Audio) {
        const seconds = (media.duration || 0) / 1000;
        audios.push({
          id: media.id,
          name: VoiceUtils.formatDuration(seconds),
          avatar: media.path,
          avatarStyle: VoiceUtils.barStyle(seconds),
          selected: false,
        });
      } else if (media.type === Resource.Type.Image) {
        images.push({
          id: media.id,
          name: '',
          avatar: OSSUtils.getPreviewUrl(media.path),
          selected: false,
        });
      }
    }
    return { images, audios };
  }

  /**
   * 署名行 VM：头像 + 昵称 + 动作。普通任务返回 undefined。
   *
   * 文案按视角分：我创建的读到「爸爸 和你一起做」，
   * 别人叫上我的读到「朵朵 邀你一起」—— 同一位置，语义靠视角自然区分。
   */
  protected adaptPartner(info: Routine.Info): Entity.Image | undefined {
    if (!this.isSelf()) return undefined; // 查看别人的任务，暂时不展示这种关系。
    const partnerId = this.getPartnerId(info);
    const user = this.getUser(partnerId);
    const name = user?.nickname || user?.name || '';
    // 拿不到昵称就不渲染署名：宁可不显示，也不要出现一个空头像
    if (!partnerId || !name) return undefined;
    return {
      id: partnerId,
      name,
      letterIndex: name.charAt(0),
      avatarStyle: AvatarUtils.randomColor(partnerId),
      desc: this.isOwner(info) ? '和你一起做' : '邀你一起',
    };
  }

  public getInfo(id: string): Routine.Info | undefined {
    return Entity.find(this.infos, id).item;
  }

  public getComments(id: string): Comment.ListResponse | undefined {
    return this.comments.get(id);
  }

  public getComment(id: string, userId: string): Comment.Info | undefined {
    const items = this.getComments(id)?.data;
    if (!items?.length) return undefined;
    for (const item of items) {
      if (item.userId === userId) {
        return item;
      }
    }
    return undefined;
  }

  public isSelf(): boolean {
    return this.userId === Context.getUserId();
  }

  /** 是否是当前用户创建的任务。委托来的任务 userId 是对方，故不能整体判断。 */
  public isOwner(info?: Routine.Info): boolean {
    return info?.userId === Context.getUserId();
  }

  /**
   * 任务里的「对方」id。
   *   我创建的   → delegated（我叫上的人）
   *   别人创建的 → userId（叫上我的人）
   * 普通任务（我自己建、没叫人）返回 undefined。
   */
  public getPartnerId(info: Routine.Info): string | undefined {
    if (info.userId === Context.getUserId()) {
      return Routine.hasDelegated(info) ? info.delegated : undefined;
    }
    return info.userId;
  }

  /** 取用户信息（署名行用），来源见 users 字段的注释 */
  public getUser(id?: string): User.Info | undefined {
    return id ? this.users.get(id) : undefined;
  }

  public addInfo(info: Routine.Info) {
    const res = Entity.find(this.infos, info.id);
    if (res.index >= 0) {
      this.infos[res.index] = info;
    } else {
      this.infos.push(info);
    }
  }

  /** 从列表移除某个任务（如委托被对方取消后，它不该再留在我的今天页） */
  public removeInfo(id: string) {
    const res = Entity.find(this.infos, id);
    if (res.index >= 0) this.infos.splice(res.index, 1);
    this.mediaMap.delete(id);
  }

  /** 加载指定日期的任务数据，返回错误码 */
  public async load(date: number, reload = false): Promise<number> {
    const today = this.getToday();
    const isSelf = this.isSelf();

    await this.loadTemplate();
    await this.loadStars(reload);

    this.date = date;
    this.isToday = date === today;
    this.updateable = isSelf && date >= today;
    this.addable = isSelf && date >= today;
    this.finishable = isSelf && date <= today;
    // withDelegated：把自己创建的任务 + 别人委托给我的任务一起拉回来。
    // 只有看自己的页面时才需要 —— 看别人的页面混进来会串号。
    const result = await Routine.list({
      date,
      userId: this.userId,
      withStat: true,
      withDelegated: isSelf,
    });
    if (typeof result === 'number') return result;
    this.infos = result.data;
    // this.users.clear();
    for (const user of result.users || []) {
      if (user?.id) this.users.set(user.id, user);
    }
    // 补拉媒体详情：mediaRemark 只是 id 串，可播放/可展示的地址需查询。
    // 失败不阻断页面（仅媒体不显示），故不返回其错误码。
    await this.loadMedias();
    return Err.Code.OK;
  }

  public async loadStars(reload = false): Promise<number> {
    if (this.relationStat && !reload) return 0;
    this.relationStat = undefined;
    this.relations = undefined;
    const stat = await Relation.stat();
    if ('number' === typeof stat) return stat;
    this.relationStat = stat;
    if (stat?.useeCount) {
      const relations = await Relation.list({
        userId: Context.getUserId(),
        star: 1,
        withStat: true,
      });
      if ('number' === typeof relations) return relations;
      this.relations = relations;
      for (const user of relations?.users || []) this.users.set(user.id, user);
    }
    return 0;
  }

  public async loadComments(id: string, reload = false): Promise<number> {
    const info = this.getInfo(id);
    if (!info) return Err.Code.Unknown;
    // 如果明确没有数据，不用拉。
    if (!info?.stat?.comment) return 0;
    if (!reload && this.getComments(id)) return 0;

    const res = await Comment.list({ ref: id });
    if ('number' === typeof res) return res;

    // 更新本地数据，免得对不上。
    this.geneStat(info, res.data);
    this.comments.set(id, res);
    return 0;
  }

  public async toggleLike(id: string): Promise<number> {
    const info = this.getInfo(id);
    if (!info) return Err.Code.Unknown;

    const liked = !info?.stat?.liked ? 1 : 0;
    const comment = this.getComment(id, Context.getUserId());
    const res = comment
      ? await Comment.update({ id: comment.id, praise: liked })
      : await Comment.create({ ref: id, praise: liked });
    if ('number' === typeof res) return res;

    this.updateLocalComment(info, id, res);
    return 0;
  }

  public async updateComment(id: string, detail: string): Promise<number> {
    const info = this.getInfo(id);
    if (!info) return Err.Code.Unknown;

    const comment = this.getComment(id, Context.getUserId());
    const res = comment
      ? await Comment.update({ id: comment.id, detail })
      : await Comment.create({ ref: id, detail });
    if ('number' === typeof res) return res;
    if (!res) return Err.Code.ServerFailed;

    this.updateLocalComment(info, id, res);
    return 0;
  }

  // 为了少拉一次接口，需要精心维护本地的数据。
  protected updateLocalComment(info: Routine.Info, id: string, comment?: Comment.Info) {
    if (!comment) return;

    const comments = this.getComments(id);
    if (!comments?.data) {
      this.comments.set(id, { data: [comment], users: [] });
    } else {
      const exist = Entity.find(comments.data, comment.id);
      if (exist?.item) {
        comments.data[exist.index] = comment;
      } else {
        comments.data.push(comment);
      }
    }
    this.geneStat(info, this.getComments(id)?.data || []);
  }

  public adaptComments(vm: RoutineUI.Record, visible?: boolean): RoutineUI.Record {
    const userId = Context.getUserId();
    const comments = this.getComments(vm.id);
    const commentVms: RoutineUI.Comment[] = [];
    const likeVms: Entity.Image[] = [];
    if (visible === undefined) visible = !vm.commentVisible;
    let commentalbe = true;
    if (visible) {
      // 按照时间倒序。
      if (comments?.data?.length) {
        comments.data.sort(
          (o1, o2) => (o2.commentTime || o2.createTime) - (o1.commentTime || o1.createTime)
        );
      }
      for (const item of comments?.data || []) {
        const isSelf = userId === item.userId;
        const user = Entity.find(comments?.users, item.userId).item;
        const name = isSelf ? '我自己' : user?.name || '未知';

        if (Comment.hasLike(item)) {
          likeVms.push({
            id: item.userId,
            name: name,
            letterIndex: name.charAt(0),
            avatarStyle: AvatarUtils.randomColor(item.userId),
          });
        }

        if (!Comment.hasComment(item)) continue;

        commentVms.push({
          id: item.id,
          name: name,
          letterIndex: name.charAt(0),
          avatarStyle: AvatarUtils.randomColor(item.userId),
          desc: item.detail,
          hint: DateUtils.formatRelative(item.commentTime || item.createTime),
          editable: userId === item.userId,
        });
        if (isSelf) commentalbe = false;
      }
    }

    // 把自己放前面。
    if (likeVms.length > 1) {
      likeVms.sort((o1, o2) => {
        if (o1.id === userId) return -1;
        if (o2.id === userId) return 1;
        return o1.name.localeCompare(o2.name);
      });
    }

    vm.commentVisible = visible;
    vm.comments = commentVms;
    vm.commentable = visible && commentalbe && !this.isSelf();
    vm.likes = { normalCount: 8, visibleCount: Math.min(8, likeVms.length), items: likeVms };
    return vm;
  }

  public adaptStars(): Partial<RoutineUI.Data> {
    const starVisible = this.isSelf() && this.isToday && !!this.relationStat?.useeCount;
    if (!this.relations?.users?.length || !starVisible) return { starVisible, stars: [] };

    const result: Entity.Image[] = [];
    for (const u of this.relations.users) {
      const name = u.nickname || u.name || '无';
      result.push({
        id: u.id,
        name: name,
        letterIndex: name[0],
        desc: `${u.routine?.finished || 0}/${u.routine?.count || 0}`,
        avatarStyle: AvatarUtils.randomColor(u.id),
      });
    }
    return { starVisible, stars: result };
  }

  /** 将加载到的数据转换为 ViewModel，按状态排序：进行中 > 已完成 */
  public adapt(): Partial<RoutineUI.Data> {
    const records: RoutineUI.Record[] = [];
    let count = 0;
    let doneCount = 0;
    let pendingCount = 0;

    const infos = this.fillHolders();
    if (infos.length && infos.length > 1) {
      infos.sort((a, b) => {
        if (a.status === b.status) return a.createTime - b.createTime;
        return a.status === Routine.Status.Working ? -1 : 1;
      });
    }
    this.addNoteHolder(infos);
    for (const info of infos) {
      const holder = info.id.startsWith('holder');
      const done = info.status === Routine.Status.Done;
      const config = RoutineAdapter.findConfig(info.category)!;
      const isNote = Routine.isNote(info.category);
      // 应该进进度吗？后台还没改。
      if (!holder) {
        count++;
        if (done) {
          doneCount++;
        } else {
          pendingCount++;
        }
      }
      let detail = '';
      if (!holder) {
        // 一句话只展示时间，不展示「开始 / 时长」
        detail = isNote
          ? `${DateUtils.formatDate(info.createTime || Date.now(), 'hh:mm')}`
          : `${config.name} · ${DateUtils.formatDate(info.planTime || Date.now(), 'hh:mm')}开始 · ${Math.floor(info.duration || 1800000) / 60000}分钟`;
      } else if (isNote) {
        // 一句话 holder 的副标题用引导语（hint）
        detail = config.hint || '';
      } else if (info?.duration) {
        detail = `${Math.floor(info.duration) / 60000}分钟`;
      }

      const record: RoutineUI.Record = {
        id: info.id,
        name: info.detail,
        detail: detail,
        category: info.category,
        color: config.color || '#f4b942',
        icon: config.icon || '/assets/imgs/ic-reading.svg',
        status: info.status,
        finishTime: info.finishTime,
        remark: info.remark,
        ...this.adaptMedias(info),
        // 委托任务的对方（署名行）；普通任务为空
        partner: this.adaptPartner(info),
        // 逐条编辑权：委托来的任务只能完成、不能改内容
        editable: this.updateable && this.isOwner(info),
        holder: holder,
        isNote: isNote,
        done,
        style: done ? 'done' : holder ? 'holder' : '',
        footers: this.adaptFooters(info),
      };
      records.push(record);
    }

    const isAllDone = count > 0 && doneCount === count;
    const progress = count ? Math.floor(doneCount * 100) / count : 0;
    const isToday = this.isToday;
    const date = this.date;
    const today = this.getToday();
    const maxMillis = this.getMaxMillis(today);
    return {
      updateable: this.updateable,
      addable: this.addable,
      finishable: this.finishable,
      nextable: maxMillis > date,
      isToday,
      dateLabel: isToday ? '今天是' : date > today ? '提前规划' : '回顾',
      dateMain: DateUtils.formatDate(date, 'M月d日 周E'),
      pickerValue: DateUtils.formatDate(date, 'yyyy-MM-dd'),
      pickerEnd: DateUtils.formatDate(maxMillis, 'yyyy-MM-dd'),
      isAllDone,
      records,
      stat: !count
        ? { id: '', name: '', progress }
        : {
            id: 'stat',
            name: `${doneCount}/${count}`,
            progress,
          },
      ...this.adaptStars(),
    };
  }

  public getToday(): number {
    return DateUtils.getToday();
  }

  public isFuture(): boolean {
    return this.date > this.getToday();
  }

  public getMaxMillis(today?: number): number {
    if (!today) today = this.getToday();
    return today + (this.isSelf() ? DateUtils.sDayMillis : 0);
  }

  protected getHolder(category: Routine.Category, index = 0): Routine.Info {
    const config = RoutineAdapter.findConfig(category);
    const template = this.findTemplate(category);
    return {
      id: 'holder' + category,
      name: '',
      detail: config.name,
      status: Routine.Status.Working,
      category: category,
      userId: '',
      date: this.date,
      transaction: '',
      duration: template?.duration,
      createTime: Date.now() + index,
    };
  }

  public async loadTemplate(reload = true): Promise<number> {
    if (reload) this.template = undefined;
    if (this.template || !this.isSelf()) return 0;
    const exist = Context.get().routineTemplate;
    const res = exist ? { routineTemplate: exist } : await User.listInfo(Context.getUserId());
    if ('number' === typeof res) return res;
    if (res?.routineTemplate) {
      const items = Config.parseTemplate([res.routineTemplate]);
      if (items?.length) {
        this.template = items[0];
        if (!exist) Context.get().routineTemplate = this.template;
      }
    }
    return 0;
  }

  public findTemplate(category: number): Partial<Routine.Info> | undefined {
    return this.template?.items?.find((o) => o.category === category);
  }

  protected fillHolders(): Routine.Info[] {
    const result = [...this.infos];
    if (!this.addable) return result;
    // 也不非要默认的不可，超过3个以上，就当作有数据了
    if (result.length >= 3 && !this.template) return result;

    const exists = result.map((item) => item.category);
    const defaults = this.template?.items?.length
      ? this.template.items.map((o) => o.category!)
      : RoutineAdapter.getDefaults();
    for (const category of defaults) {
      if (!exists.includes(category)) {
        result.push(this.getHolder(category, result.length));
      }
    }
    return result;
  }

  /**
   * 「一句话」holder 始终置顶：即使当天已经记过，入口也常在，随时可记。
   * 它不设 default，故不会被 getDefaults 当成普通 holder push 到末尾。
   */
  protected addNoteHolder(result: Routine.Info[]) {
    if (this.isToday && this.isSelf()) result.unshift(this.getHolder(Routine.Category.Note));
  }

  public adaptFooters(info: Routine.Info): Entity.Image[] {
    const stat = info.stat;
    const isSelf = this.isSelf();
    if (!stat?.comment && !stat?.count && isSelf) return [];

    return [
      {
        id: 'like',
        name: '' + (stat?.count || 0),
        avatar: '../assets/imgs/ic-like-' + (stat?.liked ? 'selected' : 'normal') + '.svg',
      },
      {
        id: 'comment',
        name: (stat?.comment || 0) + ' 条评论',
        avatar: '../assets/imgs/ic-comment-' + (stat?.commented ? 'selected' : 'normal') + '.svg',
      },
    ];
  }

  protected geneStat(info: Routine.Info, comments: Comment.Info[]) {
    const stat = this.defaultStat();
    const userId = Context.getUserId();
    for (const item of comments || []) {
      if (Comment.hasComment(item)) {
        stat.comment++;
        if (userId === item.userId) stat.commented++;
      }
      if (Comment.hasLike(item)) {
        stat.count++;
        if (userId === item.userId) stat.liked++;
      }
    }
    info.stat = stat;
  }

  protected defaultStat(): Routine.Comment {
    return { count: 0, commented: 0, comment: 0, liked: 0 };
  }
}

export namespace RoutineAdapter {
  export interface Config {
    /** 分类枚举值 */
    category: number;
    name: string;
    color: string;
    icon: string;
    /** 是否为默认/常用分类，true 的展示在创建页常用区域 */
    default?: boolean;
    hint?: string; // 任务内容提示词。
    /** 各分类的快捷示例提示词 */
    examples?: string[];
    finish?: string;
    // 各分类的完成后引导语，可能是多分类的嵌套。
    // 是三层的嵌套
    finishExamples?: Entity.Hierarchy;
    celebrates?: string[];
    invisible?: boolean;
  }

  /** 所有分类统一配置：分类枚举、颜色、图标、是否默认、示例提示词 */
  // 先放在这。未来多了，放到后台。小程序的空间有限。
  export const sConfigs: Config[] = [
    {
      category: Routine.Category.Reading,
      name: '阅读',
      color: '#f4b942',
      icon: '/assets/imgs/ic-reading.svg',
      default: true,
      // 探索/邀请语气（脚手架非压迫）+ 好奇驱动
      hint: '今天想翻开哪本书？',
      // 看得见的具体动作画面（双编码）；首条最轻量（难度匹配降初始失败）
      examples: ['DK百科', '朗读绘本', '画一页读书笔记'],
      // 引导说出具体画面+情绪（双编码/命名/叙事记忆/正向写死）
      finish: '哪一句让你心里一亮？',
      celebrates: [
        '又往脑袋里装了颗星星 📚',
        '这页书，被你变成自己的了 📖',
        '今天和作者的想法撞了一下肩 💡',
      ],
    },
    {
      category: Routine.Category.Homework,
      name: '作业',
      color: '#64B5F6',
      icon: '/assets/imgs/ic-homework.svg',
      default: true,
      hint: '今天想先攻克哪一样？',
      examples: ['出一道题', '背一首诗', '听写10个单词'],
      finish: '哪道题最让你得意？讲讲你的思路',
      celebrates: [
        '今天的难题被你收服啦 💪',
        '这一课的关卡，通关 ✅',
        // 作业也可拍照/录音提交，故不用「作业本上」这类预设纸笔的说法
        '这一项，又多了一枚你的勋章 🏅',
      ],
    },
    {
      category: Routine.Category.Exercise,
      name: '运动',
      color: '#81C784',
      icon: '/assets/imgs/ic-sport.svg',
      default: true,
      hint: '今天想让身体怎么动起来？',
      examples: ['跳绳500下', '慢跑15分钟', '平板支撑30秒'],
      finish: '动完是不是浑身轻飘飘？哪里最酸？',
      celebrates: [
        '汗水没白流，又强壮一点 ⚡',
        '心跳砰砰，身体在说谢谢 💓',
        '今天的自己，比昨天更能跑更能跳 🏃',
      ],
    },
    {
      category: Routine.Category.Chores,
      name: '家务',
      color: '#BA68C8',
      icon: '/assets/imgs/ic-housework.svg',
      hint: '想帮家里做件什么小事后？',
      examples: ['把书桌理整齐', '扫一遍地', '给绿植浇浇水'],
      finish: '看着家里变清爽，心情是不是变好了？',
      celebrates: [
        '把家变得更暖了一点 🧹',
        '小小手，把家里理得亮堂堂 ✨',
        '家人回来，会闻到你的用心 🏠',
      ],
    },
    {
      category: Routine.Category.Game,
      name: '游戏',
      color: '#F06292',
      icon: '/assets/imgs/ic-game.svg',
      hint: '今天想玩点什么开开心？',
      examples: ['我的世界', '拼完100片拼图', '来一局数独'],
      finish: '今天玩得最爽的是哪一刻？',
      celebrates: ['玩得尽兴，能量满格 ✨', '这一局，快乐拉满 🎮', '边玩边练，脑子又灵光一点 🧠'],
    },
    {
      category: Routine.Category.Handwriting,
      name: '练字',
      color: '#4DB6AC',
      icon: '/assets/imgs/ic-calligraphy.svg',
      hint: '今天想练哪一页字？',
      examples: ['两页高频字', '描红一页', '写满一页硬笔'],
      finish: '哪个字你写得最满意？圈出来看看',
      celebrates: ['这一笔，稳了 ✍️', '纸上多了一行你的安静 📝', '手和笔，越来越合拍了 🤝'],
    },
    {
      category: Routine.Category.Instrument,
      name: '音乐',
      color: '#A1887F',
      icon: '/assets/imgs/ic-instrument.svg',
      hint: '今天想让哪首曲子流出来？',
      examples: ['练熟1首练习曲', '复习三个和弦'],
      finish: '哪一段弹得最顺？闭上眼再听一遍',
      celebrates: ['耳朵和手指都在进步 🎵', '一段旋律，被你唤醒了 🎶', '今天的练习，听见了成长 🌟'],
    },
    {
      category: Routine.Category.Drawing,
      name: '绘画',
      color: '#FFD54F',
      icon: '/assets/imgs/ic-drawing.svg',
      hint: '今天想画个什么出来？',
      examples: ['素描一个静物', '涂一幅水彩风景', '画个卡通角色'],
      finish: '画里你最满意的是哪一块？',
      celebrates: [
        '今天的世界更美了一点 🎨',
        '白纸被你讲成了一个故事 🖌️',
        '颜色里，藏着你的小心情 🌈',
      ],
    },
    {
      category: Routine.Category.Coding,
      name: '编程',
      color: '#4FC3F7',
      icon: '/assets/imgs/ic-coding.svg',
      hint: '今天想捣鼓点什么小程序？',
      finish: '今天打败了哪个 Bug？怎么解决的？',
      celebrates: [
        '你的小宇宙又升级了 🚀',
        '一行代码，又听你的话了 💻',
        'Bug 退散，你又变厉害了 ⚔️',
      ],
    },
    {
      category: Routine.Category.Practice,
      name: '社会实践',
      color: '#FF8A65',
      icon: '/assets/imgs/ic-practice.svg',
      hint: '今天想去体验点什么？',
      examples: ['摆个小摊', '做次社区志愿', '逛一趟博物馆'],
      finish: '今天撞见了什么新鲜事？',
      celebrates: ['今天又长大了一点 🌱', '真实世界里，你又踩了踩脚印 👣', '经历，变成你的底气 💪'],
    },
    {
      category: Routine.Category.QA,
      name: '问答',
      color: '#7986CB',
      icon: '/assets/imgs/ic-qa.svg',
      default: true,
      hint: '今天脑子里冒出什么好奇？',
      examples: ['每日一问', '查一个百科冷知识', '成语接龙'],
      finish: '今天问的哪个问题最烧脑？',
      celebrates: [
        '好奇心又点亮一颗星 ❓',
        '今天的世界，又被你问清楚一点 🔍',
        '小问号，变成了小惊叹号 ❗',
      ],
    },
    {
      category: Routine.Category.Job,
      name: '工作',
      color: '#26C6DA',
      icon: '/assets/imgs/ic-job.svg',
      hint: '今天想推进点什么？',
      examples: ['回几条工作消息', '写完项目方案', '整理会议纪要'],
      finish: '今天哪件事让你最有成就感？',
      celebrates: [
        '今天的大事被你拿下了 🔥',
        '这一项，从待办变成搞定 ✅',
        '靠谱的，是你自己的节奏 ⏱️',
      ],
    },
    {
      category: Routine.Category.Shoot,
      name: '拍摄',
      color: '#EF5350',
      icon: '/assets/imgs/ic-shoot.svg',
      hint: '今天想定格什么画面？',
      examples: ['拍一段 Vlog', '录段朗读视频', '拍张全家福'],
      finish: '哪张照片你最想再看一遍？',
      celebrates: ['精彩瞬间被你定格 📸', '这一帧，以后会很好看 🖼️', '你眼里的世界，被留下来了 👀'],
    },
    {
      category: Routine.Category.Note,
      name: '随手记',
      // $gold-dark2 棕金/墨色：与阅读的亮金区分，有"书写"联想，未占用的变量
      color: '#C8853E',
      icon: '/assets/imgs/ic-note.svg',
      finish: '想到什么就记，日积月累',
      /**
       * 三层嵌套，语义各不相同：
       *   L1 根     = 折叠入口（不可选）
       *   L2 角度   = id 有值（可切换）；name = 角度名，desc = 疑问全文
       *   L3 灵感   = id 为空（不可点、不代填），name = 只读提示
       * 顺序是 coarse→fine 的阶梯：对比（入门）→ … → 小变化（进阶），非并列。
       */
      finishExamples: {
        id: '',
        name: '想不到记什么？试试这些角度',
        items: [
          {
            id: 'comp',
            name: '对比',
            desc: '今天和昨天有什么不一样？',
            items: [
              { id: '', name: '今天换了条路' },
              { id: '', name: '午饭和平时不一样' },
              { id: '', name: '放学时间不一样' },
            ],
          },
          {
            id: 'first',
            name: '第一次',
            desc: '今天有没有第一次发生的事？',
            items: [
              { id: '', name: '第一次自己完成的事' },
              { id: '', name: '吃到没吃过的东西' },
              { id: '', name: '去了没去过的地方' },
            ],
          },
          {
            id: 'stuck',
            name: '卡住',
            desc: '有什么没搞懂、想问的？',
            items: [
              { id: '', name: '有一道题没想通' },
              { id: '', name: '有件事不明白为什么' },
              { id: '', name: '想问但没问出口' },
            ],
          },
          {
            id: 'emotion',
            name: '情绪',
            desc: '哪一刻情绪最明显？',
            items: [
              { id: '', name: '最开心的一刻' },
              { id: '', name: '有点失落的时候' },
              { id: '', name: '被感动的一下' },
            ],
          },
          {
            id: 'quote',
            name: '谁的话',
            desc: '谁说了让你记住的话？',
            items: [
              { id: '', name: '老师说的那句话' },
              { id: '', name: '朋友跟我说的' },
              { id: '', name: '家里人念叨的' },
            ],
          },
          {
            id: 'change',
            name: '小变化',
            desc: '有什么和平时不同了？',
            items: [
              { id: '', name: '会做以前不会的事了' },
              { id: '', name: '对一件事的看法变了' },
              { id: '', name: '身边什么悄悄变了' },
            ],
          },
        ],
      },
      hint: '想到什么就记，日积月累',
      // 支持文字/图片/录音任一即可提交，故祝语不预设媒介：
      // 不用「这句话」「想法」「✍️」等只对应文字的表达，改用「这一刻」「今天」等通用说法。
      celebrates: [
        '记下了，这就是你的今天 ✨',
        '这一刻，以后看会很有意思 💫',
        '你的今天，被好好存下来了 📌',
      ],
      invisible: true,
    },
    {
      category: Routine.Category.Other,
      name: '其他',
      color: '#90A4AE',
      icon: '/assets/imgs/ic-other.svg',
      hint: '想做什么？自由发挥吧 ✨',
      examples: ['帮妈妈一个小忙', '把书包理好', '去户外探探险'],
      finish: '做完是不是挺有成就感的？',
      celebrates: [
        '想做的事，你真的去做了 ✨',
        '自由发挥，也是一种本事 🎈',
        '做完啦，给自己比个耶 👍',
      ],
    },
  ];

  /** 按分类枚举值查找配置 */
  export function findConfig(category: number): Config {
    const r = sConfigs.find((c) => c.category == category);
    if (r) return r;
    return {
      category: category,
      name: '其他',
      color: '#90A4AE',
      icon: '/assets/imgs/ic-other.svg',
    };
  }

  /** 获取所有默认/常用分类 ID */
  export function getDefaults(v = true): Routine.Category[] {
    return sConfigs.filter((c) => !!c.default === v && !c.invisible).map((c) => c.category);
  }

  /** 获取指定分类的完成反馈提示词 */
  export function getFinish(category: number): string {
    // 兜底同样不预设媒介（可为文字/图片/录音），故用「记点什么」而非「想说的」。
    return findConfig(category)?.finish || '做完了，想记点什么？';
  }

  /** 获取指定分类的完成祝语（任务完成那一刻弹出的肯定语），随机选一句以对抗脱敏 */
  export function getCelebrate(category: number): string {
    const celebrates = findConfig(category)?.celebrates;
    if (celebrates && celebrates.length) {
      return celebrates[Math.floor(Math.random() * celebrates.length)];
    }
    // 兜底：不预设媒介，也不用「最棒」这类外部评判词（避免把行为绑到外在评价上）
    return '完成了，又向前走了一小步 ✨';
  }
}
