import { CornerUpLeft } from "lucide-react"
import { Components } from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"
import { Button } from "../../../ui/button"
import { stringifyContent } from "./chatUtils"

// Create markdown components for chat message component
export const createMarkdownComponents = (
  renderCopyButton: (text: any) => JSX.Element,
  renderMarkdownElement: (props: any) => JSX.Element,
  askAboutCode: (code: any) => void
): Components => ({
  code: ({
    node,
    className,
    children,
    ...props
  }: {
    node?: import("hast").Element
    className?: string
    children?: React.ReactNode
    [key: string]: any
  }) => {
    const match = /language-(\w+)/.exec(className || "")

    return match ? (
      <div className="relative border border-input rounded-md mt-8 my-2 translate-y-[-1rem]">
        <div className="absolute top-0 left-0 px-2 py-1 text-xs font-semibold text-gray-200 rounded-tl">
          {match[1]}
        </div>
        <div className="sticky top-0 right-0 flex justify-end z-10">
          <div className="flex border border-input shadow-lg bg-background rounded-md">
            {renderCopyButton(children)}
            <div className="w-px bg-input"></div>
            <Button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                askAboutCode(children)
              }}
              size="sm"
              variant="ghost"
              className="p-1 h-6"
            >
              <CornerUpLeft className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <SyntaxHighlighter
          style={vscDarkPlus as any}
          language={match[1]}
          PreTag="div"
          customStyle={{
            margin: 0,
            padding: "0.5rem",
            fontSize: "0.875rem",
          }}
        >
          {stringifyContent(children)}
        </SyntaxHighlighter>
      </div>
    ) : (
      <code className={className} {...props}>
        {children}
      </code>
    )
  },
  // Render markdown elements
  p: ({ node, children, ...props }) =>
    renderMarkdownElement({ node, children, ...props }),
  h1: ({ node, children, ...props }) =>
    renderMarkdownElement({ node, children, ...props }),
  h2: ({ node, children, ...props }) =>
    renderMarkdownElement({ node, children, ...props }),
  h3: ({ node, children, ...props }) =>
    renderMarkdownElement({ node, children, ...props }),
  h4: ({ node, children, ...props }) =>
    renderMarkdownElement({ node, children, ...props }),
  h5: ({ node, children, ...props }) =>
    renderMarkdownElement({ node, children, ...props }),
  h6: ({ node, children, ...props }) =>
    renderMarkdownElement({ node, children, ...props }),
  ul: (props) => (
    <ul className="list-disc pl-6 mb-4 space-y-2">{props.children}</ul>
  ),
  ol: (props) => (
    <ol className="list-decimal pl-6 mb-4 space-y-2">{props.children}</ol>
  ),
})
