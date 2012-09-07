/**
 * GitHub Flavored Markdown dialect for markdown npm
 * allows for ``` code blocks
**/

var md = require('markdown');
// get Markdown class
var Markdown = md.markdown.Markdown;
// create sub-dialect
Markdown.dialects.GitHub = Markdown.subclassDialect( Markdown.dialects.Gruber );

var reStartTicks = /^```.*\n/;
var reEndTicks = /```([ \t]+)?$/;

Markdown.dialects.GitHub.block.tickedCode = function( block, nextBlocks ) {
  // var matches = block.match( reTicks );
  // console.log( matches );
  if ( !block.match( reStartTicks ) ) {
    return;
  }

  var codeBlocks = [];

  // remove start ticks
  block = block.replace( reStartTicks, '' );
  // add blocks to test when to end
  var testBlocks = [ block ].concat( nextBlocks );


  var testBlock, formattedBlock;
  for ( var i=0, len = testBlocks.length; i < len; i++ ) {
    testBlock = testBlocks[i]
    formattedBlock = testBlock.replace( '```', '' );
    codeBlocks.push( formattedBlock );

    // if we're on the 2nd+ block, start removing next blocks
    if ( i > 0 ) {
      nextBlocks.shift();
    }

    // remove next blocks if
    if ( testBlock.match( reEndTicks ) ) {
      break;
    }
  }

  return [ [ 'code_block', codeBlocks.join("\n\n") ] ];
};

Markdown.buildBlockOrder( Markdown.dialects.GitHub.block );
