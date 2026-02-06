import FinderPlugin from '../../plugins/finder/index.js';
import WikiPlugin from '../../plugins/wiki/index.js';

export const embeddedPluginModules = {
  finder: { default: FinderPlugin },
  wiki: { default: WikiPlugin }
};

