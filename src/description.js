export function descriptionText(markdown) {
 return markdown.replace(/!\[((?:\\.|[^\]\\])*)\]\(data:image\/[\w.+-]+;base64,[A-Za-z0-9+/]+={0,2}\)/g,(_image,alt) => alt ? '[Image: '+alt+']' : '[Image]');
}
