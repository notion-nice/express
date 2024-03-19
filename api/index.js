const express = require("express");
const bodyParser = require("body-parse");
const cors = require("cors");

const { RootNode, Sitdown } = require('sitdown')
const { applyWechatRule, extraFootLinks } = require('@sitdown/wechat');
const { markdownToBlocks } = require("@tryfabric/martian")

const app = express()

app.use(express.static("public"))
app.use(cors())

const gfm = new Sitdown({
    keepFilter: ['style'],
    codeBlockStyle: 'fenced',
});
const wechat = new Sitdown({
    keepFilter: ['style'],
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    hr: '---',
});
wechat.use(applyWechatRule);
const wechatToMD = (html) => {
    const root = new RootNode(html);
    const footLinks = extraFootLinks(root);
    return wechat.HTMLToMD(html, { footLinks });
};

app.use((req, res, next) => {
    if (req.originalUrl === "/webhook") {
        next()
    } else {
        bodyParser.json()(req, res, next)
    }
})

app.post("/converter", async (req, res) => {
    let markdown = gfm.HTMLToMD(req.body.html)
    switch (req.body.source) {
        case 'wechat':
            markdown = wechatToMD(req.body.html)
            break;

        default:
            break;
    }

    const blocks = markdownToBlocks(markdown)
    return res.send({ ok: true, data: { markdown, blocks } })
})

app.listen(3000, () => console.log("Server ready on port 3000."))

module.exports = app;
