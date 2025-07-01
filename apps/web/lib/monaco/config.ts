import * as monaco from "monaco-editor"

/**
 * Configure the typescript compiler to detect JSX and load type definitions
 */
export const defaultCompilerOptions: monaco.languages.typescript.CompilerOptions =
  {
    allowJs: true,
    allowSyntheticDefaultImports: true,
    allowNonTsExtensions: true,
    resolveJsonModule: true,

    jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    target: monaco.languages.typescript.ScriptTarget.ESNext,
  }

/**
 * Default Monaco editor options
 */
export const defaultEditorOptions: monaco.editor.IStandaloneEditorConstructionOptions =
  {
    tabSize: 2,
    minimap: {
      enabled: false,
    },
    padding: {
      bottom: 4,
      top: 4,
    },
    scrollBeyondLastLine: false,
    fixedOverflowWidgets: true,
    fontFamily: "var(--font-geist-mono)",
  }

/**
 * Pre-mount editor keybinding configuration
 */
export const configureEditorKeybindings = (
  monaco: typeof import("monaco-editor")
) => {
  monaco.editor.addKeybindingRules([
    {
      keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG,
      command: "null",
    },
  ])
}
