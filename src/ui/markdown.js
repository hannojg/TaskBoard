import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { tags } from '@lezer/highlight';

const descriptionInput = document.getElementById('description');
const editorContainer = document.getElementById('description-editor');
const highlighting = HighlightStyle.define([
 {tag:tags.heading1,class:'md-heading md-heading-1'},
 {tag:tags.heading2,class:'md-heading md-heading-2'},
 {tag:[tags.heading3,tags.heading4,tags.heading5,tags.heading6],class:'md-heading md-heading-small'},
 {tag:tags.strong,class:'md-strong'},
 {tag:tags.emphasis,class:'md-emphasis'},
 {tag:tags.strikethrough,class:'md-strike'},
 {tag:tags.monospace,class:'md-code'},
 {tag:tags.link,class:'md-link'},
 {tag:tags.url,class:'md-url'},
 {tag:tags.quote,class:'md-quote'},
 {tag:[tags.processingInstruction,tags.contentSeparator],class:'md-marker'}
]);
function createState(doc) {
 const keys = [...defaultKeymap,...historyKeymap,indentWithTab];
 const bindings = keymap.of(keys);
 const highlightingExtension = syntaxHighlighting(highlighting);
 const updateListener = EditorView.updateListener.of(update => {
  if (update.docChanged) descriptionInput.value = update.state.doc.toString();
 });
 const attributes = EditorView.contentAttributes.of({'aria-label':'Description','aria-multiline':'true',spellcheck:'true'});
 const language = markdown({base:markdownLanguage});
 const empty = placeholder('Write or paste Markdown…');
 const undo = history();
 const selection = drawSelection();
 return EditorState.create({doc,extensions:[language,highlightingExtension,bindings,undo,selection,EditorView.lineWrapping,attributes,empty,updateListener]});
}
const initialState = createState(descriptionInput.value);
const descriptionEditor = new EditorView({state:initialState,parent:editorContainer});
const dialog = document.getElementById('editor');
const editorObserver = new MutationObserver(() => {
 if (dialog.open) {
  const state = createState(descriptionInput.value);
  descriptionEditor.setState(state);
  descriptionEditor.requestMeasure();
 }
});
editorObserver.observe(dialog,{attributes:true,attributeFilter:['open']});
