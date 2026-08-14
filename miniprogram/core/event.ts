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
  }

  export interface DoubleTap {
    from: string;
    button: string;
  }
}
