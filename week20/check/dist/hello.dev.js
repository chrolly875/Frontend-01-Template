"use strict";

// console.log('Hello, world!');
// phantom.exit();
var page = require('webpage').create();

page.open('https://baidu.com/', function (status) {
  console.log("Status: " + status);

  if (status === "success") {
    var body = page.evaluate(function () {
      var toString = function toString(pad, element) {
        var children = element.children;
        var childrenString = '';

        for (var i = 0; i < children.length; i++) {
          childrenString += toString(" " + pad, children[i] + "\n");
        }

        return pad + element.tagName + (children.length ? "\n" + childrenString : "");
      };

      return toString("", document.body);
    });
    console.log('Page body is ' + body);
  }

  phantom.exit();
});