import {createElement} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
export default function MessageBody({text}:{text:string}){return createElement(ReactMarkdown,{remarkPlugins:[remarkGfm],rehypePlugins:[rehypeSanitize]},text);}
