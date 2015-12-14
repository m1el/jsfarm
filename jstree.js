function float_str(value) {
  if (""+parseInt(value, 10) == value) {
    return value+".0";
    // return "fround("+value+")";
  } else if (""+parseFloat(value) == value) {
    value = parseFloat(value).toFixed(20);
    return value;
    // return "fround("+value+")";
  }
}

var jst = {
  noparen: {
    'literal': true,
    'var': true,
  },
  uops: {
    '~': true,
    '+': true,
    '-': true,
    '!': true,
  },
  binops: {
    '=': true,
    '+': true,
    '-': true,
    '*': true,
    '/': true,
    '%': true,

    '|': true,
    '&': true,
    '^': true,
    '>>': true,
    '<<': true,
    '>>>': true,

    '<': true,
    '>': true,
    '>=': true,
    '<=': true,
    '!=': true,
    '==': true,
  },
  nosemicolon: {
    'block': true,
    'if': true,
    'for': true,
    'while': true,
    'do': true,
  },

  fromval: function(thing, type) {
    if (typeof thing === 'string') {
      return this.symbol(thing, type);
    }
    if (typeof thing === 'number') {
      return this.literal(thing, 'float');
    }
    if (typeof thing === 'object') {
      if ('tag' in thing) {
        return thing;
      }
      if (thing.kind === 'bool') {
        return this.literal(thing.value, 'bool');
      }
      if (thing.kind === 'number') {
        return this.literal(thing.value, 'float');
      }
      if (thing.kind === 'variable') {
        return this.fromval(thing.value, thing.type);
      }
    }
    throw 'dont know how to thing';
  },
  fake: function(thing, type) {
    var ret = this.fromval(thing, type);
    return {kind: 'variable', type: ret.type, value: ret};
  },
  fn: function(name, args, body) {
    return {tag: 'fn', name: name, args: args, body: body};
  },
  fncall: function(fn, args) {
    if (typeof fn === 'string') {
      fn = this.symbol(fn);
    }
    return {tag: 'fncall', fn: fn, args: args};
  },
  vardecl: function(name, val, type) {
    if (typeof name === 'string' &&
        !(/^[_$a-z][_$a-z0-9]*$/i.test(name))) {
      throw 'bad symbol name: ' + name;
    }
    return {tag: 'vardecl', name: name, val: val, type: type};
  },
  literal: function(val, type) {
    if (type === 'bool' || type === 'int') {
      val = val | 0;
    } else if (type === 'float') {
      val = +val;
    } else {
      throw 'unknown type: ' + type;
    }
    return {tag: 'literal', val: val, type: type};
  },
  retn: function(val) {
    return {tag: 'return', val: val};
  },
  if_: function(cond, body, other) {
    return {tag: 'if', cond: cond, body: body, other: other};
  },
  break_: function() {
    return {tag: 'break'};
  },
  symbol: function(name, type) {
    if (typeof name === 'string' &&
        !(/^[_$a-z][_$a-z0-9]*$/i.test(name))) {
      throw 'bad symbol name: ' + name;
    }
    return {tag: 'symbol', name: name, type: type};
  },
  index: function(lhs, index, type) {
    if (typeof lhs === 'string') {
      lhs = this.symbol(lhs, type);
    }
    return {tag: 'index', lhs: lhs, index: index, type: type};
  },
  uop: function(op, rhs, type) {
    if (typeof rhs === 'string') {
      rhs = this.symbol(rhs, type);
    } else if (typeof rhs === 'number') {
      rhs = this.literal(rhs, type);
    }
    if (!(op in this.uops)) {
      throw 'not a binary operator: ' + op;
    }
    return {tag: 'uop', type: type, op: op, rhs: rhs};
  },
  binop: function(lhs, op, rhs, type) {
    if (typeof lhs === 'string') {
      lhs = this.symbol(lhs, type);
    } else if (typeof lhs === 'number') {
      lhs = this.literal(lhs, type);
    }
    if (typeof rhs === 'string') {
      rhs = this.symbol(rhs, type);
    } else if (typeof rhs === 'number') {
      rhs = this.literal(rhs, type);
    }
    if (!(op in this.binops)) {
      throw 'not a binary operator: ' + op;
    }
    return {tag: 'binop', type: type, lhs: lhs, op: op, rhs: rhs};
  },
  serialize: function(ast) {
    function assert_name(name) {
      if (typeof name === 'string' &&
          !(/^[_$a-z][_$a-z0-9]*$/i.test(name))) {
        throw 'bad symbol name: ' + name;
      }
    }
    var newline;
    var code;

    switch (ast.tag) {
    case 'fn': {
      code = '';
      assert_name(ast.name);
      code += 'function ' + ast.name + '(';
      ast.args.forEach(assert_name);
      code += ast.args.join(', ');
      code += ') {';
      code += ast.body.map(function(a) {
        return this.serialize(a) + (a.tag in this.nosemicolon ? '' : ';');
      }.bind(this));
      code += '}';
      return code;
    } break;

    case 'fncall': {
      code = this.serialize(ast.fn);
      code += '(' + ast.args.map(function(e) {
        return this.serialize(e);
      }.bind(this)).join(', ') + ')';
      return code;
    } break;

    case 'block': {
      code = '{';
      code += ast.body.map(function(a) {
        return this.serialize(a) + (a.tag in this.nosemicolon ? '' : ';');
      }.bind(this));
      code += '}';
      return code;
    }

    case 'if': {
      code = 'if (' + this.serialize(ast.cond) + ')' + this.serialize(ast.body);
      if (!(ast.body.tag in this.nosemicolon)) {
        code += ';'
      }
      if (ast.other) {
        code += ' else ' + this.serialize(other);
        if (!(ast.other.tag in this.nosemicolon)) {
          code += ';'
        }
      }
      return code;
    } break;

    case 'vardecl': {
      code = 'var ' + ast.name;
      if (ast.val) {
        code += ' = ' + this.serialize(ast.val);
      }
      return code;
    } break;

    case 'symbol': {
      assert_name(ast.name)
      return ast.name;
    } break;

    case 'index': {
      assert_name(ast.lhs)
      return jst.serialize(ast.lhs) + '[' + this.serialize(ast.index) + ']';
    } break;

    case 'binop': {
      if (!(ast.op in this.binops)) {
        throw 'not a binary operator: ' + ast.op;
      }
      code = '';
      if (ast.op === '=') {
        code += this.serialize(ast.lhs);
      } else {
        code += '(' + this.serialize(ast.lhs) + ')';
      }
      code += ' ' + ast.op + ' ';
      code += '(' + this.serialize(ast.rhs) + ')';
      return code;
    } break;

    case 'uop': {
      if (!(ast.op in this.uops)) {
        throw 'not a binary operator: ' + ast.op;
      }
      code = '';
      code += ast.op + '(' + this.serialize(ast.rhs) + ')';
      return code;
    } break;

    case 'break': {
      return 'break';
    } break;

    case 'return': {
      if (ast.val) {
        return 'return ' + this.serialize(ast.val);
      } else {
        return 'return';
      }
    } break;

    case 'literal': {
      if (typeof ast.val !== 'number') {
        throw 'literal is not a number: ' + ast.val;
      }
      switch (ast.type) {
      case 'float': {
        return float_str(ast.val);
      } break;
      case 'bool':
      case 'int': {
        return '' + ast.val + '|0';
      } break;
      default: {
        throw 'dont know how to serialize literal "' + ast.type + '", "' + ast.val + '"';
      }
      }
    } break;

    default: {
      throw 'dont know how to serialize node "' + ast.tag;
    }
    }
  },
};
