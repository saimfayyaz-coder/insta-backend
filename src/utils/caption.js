// Unicode letters/digits so #café and #کراچی count as tags, like on Instagram
// The lookbehinds skip tags in the middle of a word and emails like a@b.com
const HASHTAG_REGEX = /(?<![\p{L}\p{N}_])#([\p{L}\p{N}_]+)/gu;
const MENTION_REGEX = /(?<![\w.])@([a-zA-Z0-9._]{1,30})/g;

const uniqueLower = (matches) => [...new Set(matches.map((tag) => tag.toLowerCase()))];

export const parseCaption = (caption = "") => ({
  hashtags: uniqueLower([...caption.matchAll(HASHTAG_REGEX)].map((match) => match[1])),
  mentions: uniqueLower([...caption.matchAll(MENTION_REGEX)].map((match) => match[1])),
});
