/**
 * 工具函数
 */

/**
 * 计算文本的字数（word count）
 * 支持中英文混合：
 * - 英文：按空格和标点分割计算单词数
 * - 中文：每个中文字符算一个字
 * - 数字：连续数字算一个词
 *
 * @param {string} text 输入文本
 * @return {number} 字数
 */
export function countWords(text: string): number {
  if (!text || text.trim().length === 0) {
    return 0;
  }

  // 移除首尾空格
  const trimmed = text.trim();

  // 匹配中文字符（包括中文标点）
  const chineseRegex = /[\u4e00-\u9fa5\u3400-\u4dbf\uf900-\ufaff]/g;
  const chineseMatches = trimmed.match(chineseRegex);
  const chineseCount = chineseMatches ? chineseMatches.length : 0;

  // 移除中文字符，处理英文部分
  const withoutChinese = trimmed.replace(chineseRegex, " ");

  // 英文单词：按空格、标点符号分割
  // 匹配连续的字母、数字、连字符、撇号（用于缩写如 don't）
  const englishWords = withoutChinese
    .split(/[\s\p{P}]+/u)
    .filter((word) => word.length > 0);

  // 计算英文单词数（排除纯标点）
  const englishCount = englishWords.filter((word) =>
    /[a-zA-Z0-9]/.test(word)
  ).length;

  // 总字数 = 中文字数 + 英文单词数
  return chineseCount + englishCount;
}

