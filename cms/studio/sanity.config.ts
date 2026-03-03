import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { schemaTypes } from './schemas';
import { singletonTypes, structure } from './structure';

const projectId =
  process.env.SANITY_STUDIO_PROJECT_ID ||
  process.env.VITE_SANITY_PROJECT_ID ||
  import.meta.env.VITE_SANITY_PROJECT_ID ||
  '';

const dataset =
  process.env.SANITY_STUDIO_DATASET ||
  process.env.VITE_SANITY_DATASET ||
  import.meta.env.VITE_SANITY_DATASET ||
  'production';

if (!projectId) {
  throw new Error(
    'Missing Sanity project ID. Set SANITY_STUDIO_PROJECT_ID (or VITE_SANITY_PROJECT_ID) in cms/studio/.env'
  );
}

export default defineConfig({
  name: 'spa-for-car',
  title: 'Spa for Car - CMS',
  projectId,
  dataset,
  plugins: [structureTool({ structure })],
  document: {
    newDocumentOptions: (prev, { creationContext }) => {
      if (creationContext.type === 'global') {
        return prev.filter((templateItem) => !singletonTypes.has(templateItem.templateId));
      }
      return prev;
    },
    actions: (prev, { schemaType }) =>
      singletonTypes.has(schemaType)
        ? prev.filter(
            ({ action }) => !action || !['duplicate', 'unpublish', 'delete'].includes(action)
          )
        : prev,
  },
  schema: {
    types: schemaTypes,
  },
});
