"use strict";function createMapMultiKeys(a){var c={};function l(e){if(e&&e.length===a)return 1;console.error("Multiple keys map: keys length is not equal to key count!")}return{get:function(e){if(l(e)){for(var t=c,n=0,r=e;n<r.length;n++)if(!(t=t[r[n]]))return t;return t}},set:function(e,t){if(l(e)){for(var n=c,r=e.length-1,o=0;o<r;){var i=n[e[o]];i||(n[e[o]]=i={}),n=i,++o}n[e[o]]=t}},clear:function(){c={}},delete:function(e){if(function(e){if(e&&e.length<=a)return 1;console.error("Multiple keys map: keys length is not less than key count!")}(e)){for(var t=[],n=t.length=a,r=a-1,o=e.length,i=0,l=c;i<n&&l;)t[i]=l,i<r&&i<o&&(l=l[e[i]]),++i;for(var u=r;0<=u;--u)t[u]&&u<o&&(u!==r&&Object.keys(t[u+1]).length&&u+1!==o||t[u].delete(e[u]))}},forEach:function(i){!function e(t,n){for(var r in t){var o=t[r];((n=n.concat(r)).length<a?e:i)(o,n)}}(c,[])}}}Object.defineProperty(exports,"__esModule",{value:!0}),exports.createMapMultiKeys=void 0,exports.createMapMultiKeys=createMapMultiKeys;