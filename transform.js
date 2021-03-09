const fs = require("fs");
const { Transform } = require("assemblyscript/cli/transform");
const assemblyscript = require("assemblyscript");

function isInternalElement(element) {
  return element.internalName.startsWith("~");
}

function elementHasFlag(el, flag) {
  return (el.flags & flag) != 0;
}

function typeName(type) {
  return type.name.text ?? type.name.identifier.text;
}

const AS_BIND_SRC = "lib/assembly/as-bind.ts";

class AsBindTransform extends Transform {
  afterParse(parser) {
    const bindSrc = fs.readFileSync(
      require.resolve("./" + AS_BIND_SRC),
      "utf8"
    );
    parser.parseFile(bindSrc, "~as-bind/" + AS_BIND_SRC, true);
  }
  afterInitialize(program) {
    const exportedFunctions = [...program.elementsByDeclaration.values()]
      .filter(el =>
        elementHasFlag(el, assemblyscript.CommonFlags.MODULE_EXPORT)
      )
      .filter(el => !isInternalElement(el))
      .filter(
        el =>
          el.declaration.kind === assemblyscript.NodeKind.FUNCTIONDECLARATION
      );
    const importedFunctions = [...program.elementsByDeclaration.values()]
      .filter(el => elementHasFlag(el, assemblyscript.CommonFlags.DECLARE))
      .filter(el => !isInternalElement(el))
      .filter(
        v => v.declaration.kind === assemblyscript.NodeKind.FUNCTIONDECLARATION
      );
    const typeData = {
      importedFunction: Object.fromEntries(
        importedFunctions.map(func => [
          func.name,
          {
            returnType: typeName(func.declaration.signature.returnType),
            parameters: func.declaration.signature.parameters.map(parameter =>
              typeName(parameter.type)
            )
          }
        ])
      ),
      exportedFunctions: Object.fromEntries(
        exportedFunctions.map(func => [
          func.name,
          {
            returnType: typeName(func.declaration.signature.returnType),
            parameters: func.declaration.signature.parameters.map(parameter =>
              typeName(parameter.type)
            )
          }
        ])
      )
    };
    this.typeData = JSON.stringify(typeData);
  }
  afterCompile(module) {
    module.addCustomSection(
      "bindings",
      new TextEncoder("utf8").encode(this.typeData)
    );
  }
}
module.exports = AsBindTransform;
