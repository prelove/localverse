export const embeddedManifests = {
  finder: {
    id: 'finder',
    name: {
      zh: '文件搜索',
      ja: 'ファイル検索',
      en: 'Finder'
    },
    version: '1.0.0',
    description: {
      zh: '快速搜索本地文件，支持全文检索和实时预览',
      ja: 'ローカルファイルを高速検索、全文検索とプレビュー対応',
      en: 'Fast local file search with full-text and preview support'
    },
    icon: '🔍',
    category: 'productivity',
    entry: './index.js',
    style: './style.css',
    location: {
      sidebar: {
        enabled: true,
        order: 1
      },
      shortcut: {
        global: 'Ctrl+Shift+F'
      }
    },
    permissions: [
      'filesystem:read',
      'filesystem:watch',
      'database:read',
      'database:write',
      'clipboard:write'
    ],
    dependencies: {
      services: ['FileSystemService', 'SearchService', 'DatabaseService']
    },
    settings: {
      watchPaths: {
        type: 'array',
        default: [],
        label: {
          zh: '监视路径',
          en: 'Watch paths'
        }
      },
      maxResults: {
        type: 'number',
        default: 100,
        min: 10,
        max: 1000,
        label: {
          zh: '最大结果数',
          en: 'Max results'
        }
      },
      includeHidden: {
        type: 'boolean',
        default: false,
        label: {
          zh: '包含隐藏文件',
          en: 'Include hidden files'
        }
      },
      enableContentSearch: {
        type: 'boolean',
        default: true,
        label: {
          zh: '启用内容搜索',
          en: 'Enable content search'
        }
      },
      indexExtensions: {
        type: 'array',
        default: ['txt', 'md', 'json', 'js', 'java', 'py', 'html', 'css'],
        label: {
          zh: '索引的扩展名',
          en: 'Extensions to index'
        }
      }
    }
  },
  wiki: {
    id: 'wiki',
    name: {
      zh: '知识库',
      ja: 'ナレッジベース',
      en: 'Wiki'
    },
    version: '1.0.0',
    description: {
      zh: '模块化知识管理,支持 Markdown 和双向链接',
      ja: 'モジュール式ナレッジ管理、Markdownと双方向リンク対応',
      en: 'Modular knowledge management with Markdown and bidirectional links'
    },
    icon: '📚',
    category: 'productivity',
    entry: './index.js',
    style: './style.css',
    location: {
      sidebar: {
        enabled: true,
        order: 2
      },
      shortcut: {
        global: 'Ctrl+Shift+W'
      }
    },
    permissions: [
      'database:read',
      'database:write',
      'filesystem:read',
      'filesystem:write',
      'clipboard:read',
      'clipboard:write'
    ],
    dependencies: {
      services: ['DatabaseService', 'SearchService', 'FileSystemService']
    },
    settings: {
      defaultView: {
        type: 'select',
        options: ['board', 'list', 'grid'],
        default: 'board',
        label: { zh: '默认视图', en: 'Default view' }
      },
      autoSaveInterval: {
        type: 'number',
        default: 5000,
        min: 1000,
        max: 60000,
        label: { zh: '自动保存间隔(ms)', en: 'Auto-save interval(ms)' }
      },
      enableBidirectionalLinks: {
        type: 'boolean',
        default: true,
        label: { zh: '启用双向链接', en: 'Enable bidirectional links' }
      },
      enableVersionHistory: {
        type: 'boolean',
        default: true,
        label: { zh: '启用版本历史', en: 'Enable version history' }
      }
    }
  }
};

export const embeddedLocales = {
  wiki: {
    en: {
      moduleName: 'Module Name',
      moduleDescription: 'Module Description',
      createModule: 'Create Module',
      editModule: 'Edit Module',
      deleteModule: 'Delete Module',
      columnName: 'Column Name',
      createColumn: 'Create Column',
      editColumn: 'Edit Column',
      deleteColumn: 'Delete Column',
      cardTitle: 'Card Title',
      cardContent: 'Card Content',
      preview: 'Preview',
      tags: 'Tags',
      tagsHint: 'Comma-separated tags',
      tagsEmpty: 'No tags yet',
      noSnippet: 'No snippet available',
      createCard: 'Create Card',
      editCard: 'Edit Card',
      deleteCard: 'Delete Card',
      moveCard: 'Move Card',
      pinCard: 'Pin Card',
      unpinCard: 'Unpin Card',
      addTag: 'Add Tag',
      removeTag: 'Remove Tag',
      search: 'Search',
      searchPlaceholder: 'Search cards...',
      searchResults: 'Search Results',
      searchResultsFor: 'Keyword',
      filterByTag: 'Filter by Tag',
      filterByModule: 'Filter by Module',
      noResults: 'No results found',
      unknownColumn: 'Unknown Column',
      unknownModule: 'Unknown Module',
      backlinks: 'Backlinks',
      linkedFrom: 'Linked from',
      noBacklinks: 'No backlinks',
      missingLinkHint: 'Card not created yet, click to create',
      missingLinkAction: 'Create',
      cardNotFound: 'Card not found or removed',
      versionHistory: 'Version History',
      restoreVersion: 'Restore this version',
      unsavedChanges: 'Unsaved changes',
      allChangesSaved: 'All changes saved',
      previewStatus: 'Preview',
      previewOn: 'On',
      previewOff: 'Off',
      saveSuccess: 'Saved successfully',
      saveError: 'Save failed',
      discardChangesConfirm: 'You have unsaved changes. Discard them?',
      deleteConfirm: 'Are you sure you want to delete?',
      yes: 'Yes',
      no: 'No',
      cancel: 'Cancel',
      save: 'Save',
      showPreview: 'Show Preview',
      hidePreview: 'Hide Preview',
      editorTips: 'Tip: Use [[Card Title]] to link, and #tags to mark keywords.',
      createModuleFirst: 'Please create a module first',
      createColumnFirst: 'Please create a column first',
      edit: 'Edit',
      delete: 'Delete',
      close: 'Close',
      viewBoard: 'Board View',
      viewList: 'List View',
      viewGrid: 'Grid View',
      sortByName: 'Sort by Name',
      sortByDate: 'Sort by Date',
      sortByUpdate: 'Sort by Update Time',
      exportMarkdown: 'Export as Markdown',
      exportJson: 'Export as JSON',
      importMarkdown: 'Import Markdown',
      importJson: 'Import JSON',
      settings: 'Settings',
      welcome: 'Welcome to Wiki',
      welcomeMessage: 'Start by creating your first module',
      emptyModule: 'This module has no columns yet',
      emptyColumn: 'This column has no cards yet'
    },
    zh: {
      moduleName: '模块名称',
      moduleDescription: '模块描述',
      createModule: '创建模块',
      editModule: '编辑模块',
      deleteModule: '删除模块',
      columnName: '列名',
      createColumn: '创建列',
      editColumn: '编辑列',
      deleteColumn: '删除列',
      cardTitle: '卡片标题',
      cardContent: '卡片内容',
      preview: '预览',
      tags: '标签',
      tagsHint: '使用逗号分隔标签',
      tagsEmpty: '暂无标签',
      noSnippet: '暂无内容摘要',
      createCard: '创建卡片',
      editCard: '编辑卡片',
      deleteCard: '删除卡片',
      moveCard: '移动卡片',
      pinCard: '置顶卡片',
      unpinCard: '取消置顶',
      addTag: '添加标签',
      removeTag: '删除标签',
      search: '搜索',
      searchPlaceholder: '搜索卡片...',
      searchResults: '搜索结果',
      searchResultsFor: '关键词',
      filterByTag: '按标签筛选',
      filterByModule: '按模块筛选',
      noResults: '没有找到结果',
      unknownColumn: '未知列',
      unknownModule: '未知模块',
      backlinks: '反向链接',
      linkedFrom: '被以下卡片引用',
      noBacklinks: '没有反向链接',
      missingLinkHint: '未创建卡片，点击即可创建',
      missingLinkAction: '可创建',
      cardNotFound: '卡片不存在或已删除',
      versionHistory: '版本历史',
      restoreVersion: '恢复此版本',
      unsavedChanges: '有未保存的更改',
      allChangesSaved: '所有更改已保存',
      previewStatus: '预览',
      previewOn: '开启',
      previewOff: '关闭',
      saveSuccess: '保存成功',
      saveError: '保存失败',
      discardChangesConfirm: '有未保存的更改，确定要放弃吗？',
      deleteConfirm: '确定要删除吗？',
      yes: '是',
      no: '否',
      cancel: '取消',
      save: '保存',
      showPreview: '显示预览',
      hidePreview: '隐藏预览',
      editorTips: '提示：使用 [[卡片名]] 创建链接，使用 #标签 记录关键字。',
      createModuleFirst: '请先创建一个模块',
      createColumnFirst: '请先创建一个列',
      edit: '编辑',
      delete: '删除',
      close: '关闭',
      viewBoard: '看板视图',
      viewList: '列表视图',
      viewGrid: '网格视图',
      sortByName: '按名称排序',
      sortByDate: '按日期排序',
      sortByUpdate: '按更新时间排序',
      exportMarkdown: '导出为 Markdown',
      exportJson: '导出为 JSON',
      importMarkdown: '导入 Markdown',
      importJson: '导入 JSON',
      settings: '设置',
      welcome: '欢迎使用 Wiki 知识库',
      welcomeMessage: '开始创建您的第一个模块',
      emptyModule: '此模块还没有列',
      emptyColumn: '此列还没有卡片'
    },
    ja: {
      moduleName: 'モジュール名',
      moduleDescription: 'モジュールの説明',
      createModule: 'モジュールを作成',
      editModule: 'モジュールを編集',
      deleteModule: 'モジュールを削除',
      columnName: 'カラム名',
      createColumn: 'カラムを作成',
      editColumn: 'カラムを編集',
      deleteColumn: 'カラムを削除',
      cardTitle: 'カードタイトル',
      cardContent: 'カード内容',
      preview: 'プレビュー',
      tags: 'タグ',
      tagsHint: 'カンマで区切って入力',
      tagsEmpty: 'タグはまだありません',
      noSnippet: '概要はありません',
      createCard: 'カードを作成',
      editCard: 'カードを編集',
      deleteCard: 'カードを削除',
      moveCard: 'カードを移動',
      pinCard: 'カードをピン留め',
      unpinCard: 'ピン留めを解除',
      addTag: 'タグを追加',
      removeTag: 'タグを削除',
      search: '検索',
      searchPlaceholder: 'カードを検索...',
      searchResults: '検索結果',
      searchResultsFor: 'キーワード',
      filterByTag: 'タグでフィルター',
      filterByModule: 'モジュールでフィルター',
      noResults: '結果が見つかりません',
      unknownColumn: '不明なカラム',
      unknownModule: '不明なモジュール',
      backlinks: 'バックリンク',
      linkedFrom: '以下のカードからリンクされています',
      noBacklinks: 'バックリンクはありません',
      missingLinkHint: 'カードは未作成です。クリックして作成',
      missingLinkAction: '作成',
      cardNotFound: 'カードが見つからないか削除されました',
      versionHistory: 'バージョン履歴',
      restoreVersion: 'このバージョンを復元',
      unsavedChanges: '未保存の変更があります',
      allChangesSaved: 'すべての変更が保存されました',
      previewStatus: 'プレビュー',
      previewOn: 'オン',
      previewOff: 'オフ',
      saveSuccess: '保存しました',
      saveError: '保存に失敗しました',
      discardChangesConfirm: '未保存の変更があります。破棄しますか？',
      deleteConfirm: '削除してもよろしいですか？',
      yes: 'はい',
      no: 'いいえ',
      cancel: 'キャンセル',
      save: '保存',
      showPreview: 'プレビューを表示',
      hidePreview: 'プレビューを非表示',
      editorTips: 'ヒント: [[カード名]] でリンク、#タグ でキーワードを記録します。',
      createModuleFirst: '先にモジュールを作成してください',
      createColumnFirst: '先にカラムを作成してください',
      edit: '編集',
      delete: '削除',
      close: '閉じる',
      viewBoard: 'ボードビュー',
      viewList: 'リストビュー',
      viewGrid: 'グリッドビュー',
      sortByName: '名前で並べ替え',
      sortByDate: '日付で並べ替え',
      sortByUpdate: '更新日時で並べ替え',
      exportMarkdown: 'Markdownとしてエクスポート',
      exportJson: 'JSONとしてエクスポート',
      importMarkdown: 'Markdownをインポート',
      importJson: 'JSONをインポート',
      settings: '設定',
      welcome: 'Wikiへようこそ',
      welcomeMessage: '最初のモジュールを作成してください',
      emptyModule: 'このモジュールにはまだカラムがありません',
      emptyColumn: 'このカラムにはまだカードがありません'
    }
  }
};

export const embeddedPluginIds = Object.keys(embeddedManifests);
