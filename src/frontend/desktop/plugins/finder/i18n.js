/**
 * Finder Plugin Internationalization
 * Translations for all supported languages
 */

export const translations = {
  en: {
    searchPlaceholder: 'Search files...',
    allTypes: 'All Types',
    documents: 'Documents',
    images: 'Images',
    code: 'Code',
    other: 'Other',
    noResults: 'No files found',
    searching: 'Searching...',
    results: 'results',
    navigate: 'navigate',
    open: 'open',
    copyPath: 'copy path',
    searchError: 'Search failed',
    openError: 'Failed to open file',
    copyError: 'Failed to copy path',
    pathCopied: 'Path copied to clipboard',
    preview: 'Preview',
    fileName: 'Name',
    filePath: 'Path',
    fileSize: 'Size',
    modified: 'Modified',
    previewNotAvailable: 'Preview not available for this file type'
  },
  zh: {
    searchPlaceholder: '搜索文件...',
    allTypes: '所有类型',
    documents: '文档',
    images: '图片',
    code: '代码',
    other: '其他',
    noResults: '未找到文件',
    searching: '搜索中...',
    results: '个结果',
    navigate: '导航',
    open: '打开',
    copyPath: '复制路径',
    searchError: '搜索失败',
    openError: '打开文件失败',
    copyError: '复制路径失败',
    pathCopied: '路径已复制到剪贴板',
    preview: '预览',
    fileName: '名称',
    filePath: '路径',
    fileSize: '大小',
    modified: '修改时间',
    previewNotAvailable: '此文件类型暂不支持预览'
  },
  ja: {
    searchPlaceholder: 'ファイルを検索...',
    allTypes: 'すべてのタイプ',
    documents: 'ドキュメント',
    images: '画像',
    code: 'コード',
    other: 'その他',
    noResults: 'ファイルが見つかりません',
    searching: '検索中...',
    results: '件の結果',
    navigate: 'ナビゲート',
    open: '開く',
    copyPath: 'パスをコピー',
    searchError: '検索に失敗しました',
    openError: 'ファイルを開けませんでした',
    copyError: 'パスのコピーに失敗しました',
    pathCopied: 'パスをクリップボードにコピーしました',
    preview: 'プレビュー',
    fileName: '名前',
    filePath: 'パス',
    fileSize: 'サイズ',
    modified: '更新日時',
    previewNotAvailable: 'このファイルタイプのプレビューは利用できません'
  }
};

/**
 * Get translation for a key
 * @param {string} key - Translation key
 * @param {string} locale - Locale code (default: 'en')
 * @returns {string} - Translated string
 */
export function t(key, locale = 'en') {
  const localeTranslations = translations[locale] || translations.en;
  return localeTranslations[key] || translations.en[key] || key;
}

/**
 * Get all translations for a locale
 * @param {string} locale - Locale code
 * @returns {Object} - Translations object
 */
export function getTranslations(locale = 'en') {
  return translations[locale] || translations.en;
}
