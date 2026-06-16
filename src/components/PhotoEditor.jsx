import FilerobotImageEditor, { TABS, TOOLS } from 'react-filerobot-image-editor'

// Full image editor (crop, rotate, text, draw/annotate, image overlay, filters).
// `source` is a local object-URL (same origin) so the export canvas isn't tainted.
// onSave receives Filerobot's edited image object (we use imageBase64).
export default function PhotoEditor({ source, onSave, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2500, background: '#000' }}>
      <FilerobotImageEditor
        source={source}
        onSave={(edited) => onSave(edited)}
        onClose={onClose}
        Text={{ text: 'Text' }}
        tabsIds={[TABS.ANNOTATE, TABS.ADJUST, TABS.WATERMARK, TABS.FINETUNE, TABS.FILTERS, TABS.RESIZE]}
        defaultTabId={TABS.ANNOTATE}
        defaultToolId={TOOLS.TEXT}
        savingPixelRatio={1}
        previewPixelRatio={1}
      />
    </div>
  )
}
