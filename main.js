// Raw Source code for shaders

//--Vertex Shader--//
var vertexShaderSrc = 
[
'precision mediump float;',
'',
'attribute vec3 aPosition;',
'attribute vec3 aColor;',
'',
'uniform mat4 uModelViewMatrix;',
'uniform mat4 uProjectionMatrix;',
'uniform mat4 uModelTransformationMatrix;',
'',
'varying vec3 fragColor;',
'',
'void main() {',
'   gl_Position = uProjectionMatrix * uModelViewMatrix * uModelTransformationMatrix * vec4(aPosition, 1.0);',
'   fragColor = aColor;',
'}'
].join('\n');

//--Fragment Shader--//
var fragShaderSrc = 
[
'precision mediump float;',
'',
'varying vec3 fragColor;',
'void main() {',
'   gl_FragColor = vec4(fragColor, 1.0);',
'}'
].join('\n');