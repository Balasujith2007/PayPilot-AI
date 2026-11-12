import React from "react"

/**
 * Parses inline formatting for assistant messages:
 * - Bold text: **bold**
 * - Auto-linking: http:// and https:// URLs only
 * Pure React elements, 0 HTML strings, 0 dangerouslySetInnerHTML.
 */
function parseInline(text: string): React.ReactNode[] {
  // Regex matching either an http(s) URL or **bold** text
  const tokenRegex = /(https?:\/\/[^\s<>"'()]+|\*\*.+?\*\*)/g

  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(text)) !== null) {
    // Add text preceding the match
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    const token = match[0]
    if (token.startsWith("http://") || token.startsWith("https://")) {
      nodes.push(
        React.createElement(
          "a",
          {
            key: `link-${match.index}`,
            href: token,
            target: "_blank",
            rel: "noopener noreferrer",
            className:
              "underline underline-offset-2 font-medium text-black hover:text-black/70 transition-colors break-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black rounded-xs",
          },
          token
        )
      )
    } else if (token.startsWith("**") && token.endsWith("**")) {
      const inner = token.slice(2, -2)
      nodes.push(
        React.createElement(
          "strong",
          {
            key: `bold-${match.index}`,
            className: "font-semibold text-black",
          },
          inner
        )
      )
    } else {
      nodes.push(token)
    }

    lastIndex = match.index + token.length
  }

  // Add trailing text
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}

/**
 * Formats an assistant plain-text response into safe React elements:
 * - Paragraphs on blank lines
 * - Bullet lists on lines starting with "- " or "* "
 * - Bold formatting (**text**)
 * - Auto-linking http(s) URLs
 */
export function formatAssistantMessage(content: string): React.ReactNode {
  if (!content) return null

  // Split into blocks by double newlines
  const rawBlocks = content.split(/\n\s*\n/)

  const elements: React.ReactNode[] = []

  rawBlocks.forEach((block, blockIdx) => {
    const trimmedBlock = block.trim()
    if (!trimmedBlock) return

    const lines = trimmedBlock.split("\n")

    // Group contiguous bullet lines vs paragraph lines
    let currentBullets: string[] = []
    let currentParagraph: string[] = []

    const flushParagraph = (key: string) => {
      if (currentParagraph.length > 0) {
        const text = currentParagraph.join(" ")
        elements.push(
          React.createElement(
            "p",
            {
              key,
              className: "leading-relaxed",
            },
            ...parseInline(text)
          )
        )
        currentParagraph = []
      }
    }

    const flushBullets = (key: string) => {
      if (currentBullets.length > 0) {
        const items = currentBullets.map((bulletText, itemIdx) =>
          React.createElement(
            "li",
            {
              key: `item-${itemIdx}`,
              className: "flex items-start gap-2 leading-relaxed",
            },
            React.createElement(
              "span",
              {
                className: "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-black/60",
                "aria-hidden": "true",
              },
              null
            ),
            React.createElement("span", { className: "flex-1" }, ...parseInline(bulletText))
          )
        )

        elements.push(
          React.createElement(
            "ul",
            {
              key,
              className: "my-1.5 space-y-1.5 pl-0.5",
            },
            items
          )
        )
        currentBullets = []
      }
    }

    lines.forEach((line, lineIdx) => {
      const trimmedLine = line.trim()
      if (trimmedLine.startsWith("- ") || trimmedLine.startsWith("* ")) {
        flushParagraph(`p-${blockIdx}-${lineIdx}`)
        currentBullets.push(trimmedLine.slice(2).trim())
      } else {
        flushBullets(`ul-${blockIdx}-${lineIdx}`)
        currentParagraph.push(trimmedLine)
      }
    })

    flushParagraph(`p-${blockIdx}-end`)
    flushBullets(`ul-${blockIdx}-end`)
  })

  return React.createElement(
    "div",
    { className: "space-y-2.5 leading-relaxed break-words" },
    ...elements
  )
}

