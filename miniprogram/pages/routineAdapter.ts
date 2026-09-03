import { Err } from '../constant/error';
import { Context } from '../core/context';
import { Entity } from '../model/entity';
import { Comment } from '../server/comment';
import { Config } from '../server/config';
import { Relation } from '../server/relation';
import { Routine } from '../server/routine';
import { User } from '../server/user';
import { AvatarUtils } from '../utils/avatarUtils';
import { DateUtils } from '../utils/dateUtils';
import { Utils } from '../utils/utils';
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

  public addInfo(info: Routine.Info) {
    const res = Entity.find(this.infos, info.id);
    if (res.index >= 0) {
      this.infos[res.index] = info;
    } else {
      this.infos.push(info);
    }
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
    const result = await Routine.list({ date, userId: this.userId, withStat: true });
    if (typeof result === 'number') return result;
    this.infos = result;
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
      const isNote = info.category === Routine.Category.Note;
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
          ? `${config.name} · ${DateUtils.formatDate(info.createTime || Date.now(), 'hh:mm')}`
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
    result.unshift(this.getHolder(Routine.Category.Note));
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
        '作业本上，又多了一枚你的勋章 🏅',
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
      finish: '再多说一点点？',
      hint: '想到什么就记，日积月累',
      celebrates: [
        '记下了，这就是你的今天 ✍️',
        '这句话，以后看会很有意思 💫',
        '你的想法被好好保存下来了 📌',
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
    return findConfig(category)?.finish || '做完啦，有什么想说的？';
  }

  /** 获取指定分类的完成祝语（任务完成那一刻弹出的肯定语），随机选一句以对抗脱敏 */
  export function getCelebrate(category: number): string {
    const celebrates = findConfig(category)?.celebrates;
    if (celebrates && celebrates.length) {
      return celebrates[Math.floor(Math.random() * celebrates.length)];
    }
    return '完成就是最棒的 ✨';
  }
}
