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
    allSizes: 'Any Size',
    sizeSmall: 'Small (<1MB)',
    sizeMedium: 'Medium (1-10MB)',
    sizeLarge: 'Large (>10MB)',
    allDates: 'Any Time',
    dateDay: 'Last 24h',
    dateWeek: 'Last 7 days',
    dateMonth: 'Last 30 days',
    dateYear: 'Last year',
    extensionPlaceholder: 'Extension',
    noResults: 'No files found',
    searching: 'Searching...',
    results: 'results',
    navigate: 'navigate',
    open: 'open',
    previewShortcut: 'Space preview',
    copyPath: 'copy path',
    closeOrClear: 'close/clear',
    searchError: 'Search failed',
    searchFallback: 'File search service unavailable, using local index',
    openError: 'Failed to open file',
    copyError: 'Failed to copy path',
    pathCopied: 'Path copied to clipboard',
    preview: 'Preview',
    fileName: 'Name',
    filePath: 'Path',
    fileSize: 'Size',
    modified: 'Modified',
    previewNotAvailable: 'Preview not available for this file type',
    previewTextTooLarge: 'Text preview skipped ({size} > {limit})',
    previewImageTooLarge: 'Image preview skipped ({size} > {limit})'
  },
  zh: {
    searchPlaceholder: '搜索文件...',
    allTypes: '所有类型',
    documents: '文档',
    images: '图片',
    code: '代码',
    other: '其他',
    allSizes: '所有大小',
    sizeSmall: '小于 1MB',
    sizeMedium: '1-10MB',
    sizeLarge: '大于 10MB',
    allDates: '全部时间',
    dateDay: '24 小时内',
    dateWeek: '7 天内',
    dateMonth: '30 天内',
    dateYear: '一年内',
    extensionPlaceholder: '扩展名',
    noResults: '未找到文件',
    searching: '搜索中...',
    results: '个结果',
    navigate: '导航',
    open: '打开',
    previewShortcut: '空格预览',
    copyPath: '复制路径',
    closeOrClear: '关闭/清空',
    searchError: '搜索失败',
    searchFallback: '文件搜索服务不可用，已切换本地索引',
    openError: '打开文件失败',
    copyError: '复制路径失败',
    pathCopied: '路径已复制到剪贴板',
    preview: '预览',
    fileName: '名称',
    filePath: '路径',
    fileSize: '大小',
    modified: '修改时间',
    previewNotAvailable: '此文件类型暂不支持预览',
    previewTextTooLarge: '文本预览已跳过（{size} > {limit}）',
    previewImageTooLarge: '图片预览已跳过（{size} > {limit}）'
  },
  ja: {
    searchPlaceholder: 'ファイルを検索...',
    allTypes: 'すべてのタイプ',
    documents: 'ドキュメント',
    images: '画像',
    code: 'コード',
    other: 'その他',
    allSizes: 'すべてのサイズ',
    sizeSmall: '1MB未満',
    sizeMedium: '1-10MB',
    sizeLarge: '10MB以上',
    allDates: 'すべての期間',
    dateDay: '24時間以内',
    dateWeek: '7日以内',
    dateMonth: '30日以内',
    dateYear: '1年以内',
    extensionPlaceholder: '拡張子',
    noResults: 'ファイルが見つかりません',
    searching: '検索中...',
    results: '件の結果',
    navigate: 'ナビゲート',
    open: '開く',
    previewShortcut: 'スペースでプレビュー',
    copyPath: 'パスをコピー',
    closeOrClear: '閉じる/クリア',
    searchError: '検索に失敗しました',
    searchFallback: 'ファイル検索サービスが利用できないためローカル検索に切り替えました',
    openError: 'ファイルを開けませんでした',
    copyError: 'パスのコピーに失敗しました',
    pathCopied: 'パスをクリップボードにコピーしました',
    preview: 'プレビュー',
    fileName: '名前',
    filePath: 'パス',
    fileSize: 'サイズ',
    modified: '更新日時',
    previewNotAvailable: 'このファイルタイプのプレビューは利用できません',
    previewTextTooLarge: 'テキストプレビューを省略しました（{size} > {limit}）',
    previewImageTooLarge: '画像プレビューを省略しました（{size} > {limit}）'
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
