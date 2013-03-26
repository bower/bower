# Bower gh-pages

The `index.html` page is generated from the `template.{` template in `build/`.
It converts the markdown from the master branch's README and inserts it into the
template.

To build a new version of the page after modifying the template, do the following:

```
cd build/
npm install
node index.js
```
