import Reader from "./shift-reader";
import Expander from "./expander";
import { List } from "immutable";
import Syntax from "./syntax";
import Env from "./env";
import reduce from "shift-reducer";
import ParseReducer from "./parse-reducer";
import codegen from "shift-codegen";
import moduleResolver from './node-module-resolver';
import moduleLoader from './node-module-loader';
import { Scope, freshScope } from "./scope";

import BindingMap from "./binding-map.js";

import Term from "./terms";
import { Symbol } from "./symbol";
import { Modules } from './modules';

export function expand(source, options = {}) {
  let reader = new Reader(source);
  let stxl = reader.read();
  let scope = freshScope('top');
  let bindings = new BindingMap();
  let expander = new Expander({
    env: new Env(),
    store: new Env(),
    bindings: bindings,
    cwd: options.cwd,
    modules: new Modules(),
    currentScope: [scope],
    transform: options.transform ? options.transform : function(x) { return {code: x}; },
    followImports: options.followImports,
    moduleResolver: options.moduleResolver ? options.moduleResolver : moduleResolver,
    moduleLoader: options.moduleLoader ? options.moduleLoader : moduleLoader
  });
  let exStxl = expander.expand(stxl.map(s => s.addScope(scope, bindings)));
  return new Term("Module", {
    directives: List(),
    items: exStxl
  });
}

export function parse(source, options = {}) {
  return reduce(new ParseReducer(), expand(source, options));
}

export function compile(source, cwd, { transform }) {
  let ast = parse(source, {
    cwd: cwd,
    transform
  });
  let gen = codegen(ast);
  return transform ? transform(gen) : gen;
}
