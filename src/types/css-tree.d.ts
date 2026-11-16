declare module 'css-tree' {
  export interface ListItem<T> {
    data: T
    prev: ListItem<T> | null
    next: ListItem<T> | null
  }

  export interface List<T> {
    remove(item: ListItem<T>): ListItem<T>
    toArray(): T[]
  }

  export type CssNode =
    | { type: 'StyleSheet'; children: List<CssNode> }
    | { type: 'Rule'; prelude: CssNode; block: { type: 'Block'; children: List<CssNode> } }
    | { type: 'Atrule'; name: string; prelude: CssNode | null; block: CssNode | null }
    | { type: 'Declaration'; property: string; value: CssNode }
    | { type: 'SelectorList'; children: List<CssNode> }
    | { type: 'AttributeSelector'; name: { name: string } }
    | { type: 'Url'; value: string }
    | { type: 'String'; value: string }
    | { type: 'Function'; name: string; children: List<CssNode> }
    | { type: 'Raw'; value: string }
    | { type: 'Value'; children: List<CssNode> }
    | { type: 'Block'; children: List<CssNode> }

  export interface ParseOptions {
    context?: 'stylesheet' | 'declarationList' | 'declaration' | 'value'
    parseAtrulePrelude?: boolean
    parseRulePrelude?: boolean
    parseValue?: boolean
    onParseError?: (error: Error, fallbackNode: CssNode) => void
  }

  export function parse(text: string, options?: ParseOptions): CssNode
  export function generate(ast: CssNode): string

  export type WalkEnter = (
    this: unknown,
    node: CssNode,
    item: ListItem<CssNode> | null,
    list: List<CssNode> | null
  ) => symbol | void

  export interface WalkFn {
    (ast: CssNode, options: WalkEnter | { enter?: WalkEnter; leave?: WalkEnter }): void
    skip: symbol
  }

  export const walk: WalkFn
}
