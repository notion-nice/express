import { markdownToBlocks } from "@tryfabric/martian"
import { fromHtml } from "hast-util-from-html"
import { toMdast } from "hast-util-to-mdast"
import { toMarkdown } from "mdast-util-to-markdown"

const p = {
  html: "<h1>xxxx</h1>"
}

const hast = fromHtml(p.html, { fragment: true })
const mdast = toMdast(hast)
const markdown = toMarkdown(mdast)
console.log(markdown, markdownToBlocks(markdown))
