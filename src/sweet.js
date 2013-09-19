/*
  Copyright (C) 2012 Tim Disney <tim@disnet.me>

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/


(function (root, factory) {
    if (typeof exports === 'object') {
        // CommonJS
        var parser = require("./parser");
        var expander = require("./expander");
        var codegen = require("escodegen");

        var path = require('path');
        var fs   = require('fs');
        var lib  = path.join(path.dirname(fs.realpathSync(__filename)), "../macros");

        var stxcaseModule = fs.readFileSync(lib + "/stxcase.js", 'utf8');

        factory(exports, parser, expander, stxcaseModule, codegen);

        // Alow require('./example') for an example.sjs file.
        require.extensions['.sjs'] = function(module, filename) {
            var content = require('fs').readFileSync(filename, 'utf8');
            module._compile(codegen.generate(exports.parse(content)), filename);
        };
    } else if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['exports', './parser', './expander', 'text!./stxcase.js'], factory);
    }
}(this, function (exports, parser, expander, stxcaseModule, gen) {
    var codegen = gen || escodegen;

    // fun (Str) -> [...CSyntax]
    function expand(code) {
        var program, toString;

        toString = String;
        if (typeof code !== 'string' && !(code instanceof String)) {
            code = toString(code);
        }
        
        var source = code;

        if (source.length > 0) {
            if (typeof source[0] === 'undefined') {
                // Try first to convert to a string. This is good as fast path
                // for old IE which understands string indexing for string
                // literals only and not for string object.
                if (code instanceof String) {
                    source = code.valueOf();
                }

                // Force accessing the characters via an array.
                if (typeof source[0] === 'undefined') {
                    source = stringToArray(code);
                }
            }
        }

        source = stxcaseModule + "\n\n" + source;

        var readTree = parser.read(source);
        return [expander.expand(readTree[0], stxcaseModule), readTree[1]];
    }

    // fun (Str, {}) -> AST
    function parse(code) {
        var exp = expand(code);

        var lineoffset = 2;
        for (var i = 0; i < stxcaseModule.length; i++) {
            if (stxcaseModule[i] === "\n") {
                lineoffset++;
            }
        }
        var linestartoffset = stxcaseModule.length + 2;
        var adjustedStx = exp[0];
        var adjustedComments = exp[1];
        if (typeof lineoffset !== 'undefined') {
            adjustedStx = exp[0].map(function(stx) {
                stx.token.sm_lineNumber -= lineoffset;
                stx.token.sm_lineStart -= linestartoffset;
                stx.token.range[0] -= linestartoffset;
                stx.token.range[1] -= linestartoffset;
                return stx;
            });
            adjustedComments = exp[1].map(function(tok) {
                tok.range[0] -= linestartoffset;
                tok.range[1] -= linestartoffset;
                return tok;
            }) 
        }
        return parser.parse(adjustedStx, adjustedComments);
    }

    exports.expand = expand;
    exports.parse = parse;

    exports.compileWithSourcemap = function(code, filename) {
        var ast = parse(code);
        codegen.attachComments(ast, ast.comments, ast.tokens);
        var code_output = codegen.generate(ast, {
            comment: true
        });
        var sourcemap = codegen.generate(ast, {
            sourceMap: filename
        });

        return [code_output, sourcemap];
        
    }

    exports.compile = function compile(code) {
        var ast = parse(code);
        codegen.attachComments(ast, ast.comments, ast.tokens);
        return codegen.generate(ast, {
            comment: true
        });
    }
}));
