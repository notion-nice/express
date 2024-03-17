import { markdownToBlocks } from "@tryfabric/martian"
import { fromHtml } from "hast-util-from-html"
import { toMdast } from "hast-util-to-mdast"
import { toMarkdown } from "mdast-util-to-markdown"

// import sitdownConverter from "./sitdownConverter"

// export const html2blocks = (p) => {
//   const markdown = sitdownConverter.GFM(req.body.html)
//   if (!p.toBlock) {
//     return markdown
//   }
//   // Markdown string to Notion Blocks
//   const blocks = markdownToBlocks(markdown)
//   return blocks
// }

export const converterHtmlToBlocks = (p) => {
  //   Create a new customer object
  const hast = fromHtml(p.html, { fragment: true })
  const mdast = toMdast(hast)
  const markdown = toMarkdown(mdast)
  if (!p.toBlock) {
    return markdown
  }
  // Markdown string to Notion Blocks
  const blocks = markdownToBlocks(markdown)
  res.send({ blocks })
}
