export namespace Event {
  export const enum Name {
    OnDoubleTap = 'OnDoubleTap',

    onAddTap = 'OnAddTap',

    /**
     * 任务创建、更新成功
     */
    RoutineUpdated = 'RoutineUpdated',

    /**
     * 其他地方也得更新。
     */
    RelationUpdated = 'RelationUpdated',

    /**
     * 模板更新。
     */
    TemplateUpdated = 'templateUpdated',
  }

  export interface DoubleTap {
    from: string;
    button: string;
  }
}
