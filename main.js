var esprima = require("esprima");
var options = {tokens:true, tolerant: true, loc: true, range: true };
var faker = require("faker");
var fs = require("fs");
faker.locale = "en";
var mock = require('mock-fs');
var _ = require('underscore');
var Random = require('random-js');
var product = require('cartesian-product');


function main()
{
	var args = process.argv.slice(2);

	if( args.length == 0 )
	{
		args = ["mystery.js"];
	}
	var filePath = args[0];

	constraints(filePath);

	generateTestCases()

}

var engine = Random.engines.mt19937().autoSeed();

function createConcreteIntegerValue( greaterThan, constraintValue )
{
	if( greaterThan )
		return Random.integer(constraintValue,constraintValue+10)(engine);
	else
		return Random.integer(constraintValue-10,constraintValue)(engine);
}

function Constraint(properties)
{
	
	this.ident = properties.ident;
	this.expression = properties.expression;
	this.operator = properties.operator;
	this.value = properties.value;
	this.altvalue = properties.altvalue;
	this.funcName = properties.funcName;
	// Supported kinds: "fileWithContent","fileExists"
	// integer, string, phoneNumber
	this.kind = properties.kind;
}

function fakeDemo()
{
	console.log( faker.phone.phoneNumber() );
	console.log( faker.phone.phoneNumberFormat() );
	console.log( faker.phone.phoneFormats() );
}

var functionConstraints =
{
}

var mockFileLibrary = 
{
	pathExists:
	{
		'path/fileExists': {'txt1.txt':'file1'},
		'path/dir' : {}
	},
	fileWithContent:
	{
		pathContent: 
		{	
  			"txt1.txt": 'content',
  			"txt2.txt": '',
		}
	}
};

function initalizeParams(constraints)
{
	var params = {};
	
	// initialize params
	for (var i =0; i < constraints.params.length; i++ )
	{
		var paramName = constraints.params[i];
		params[paramName] = [];
	}
	return params;	
}

function fillParams(constraints,params,property)
{
	for( var c = 0; c < constraints.length; c++ )
	{
		var constraint = constraints[c];
		if( params.hasOwnProperty( constraint.ident ) )
		{
			if(!params[constraint.ident])
			{
				params[constraint.ident] = []
			}
			if ((constraint.ident == "dir") &&( constraint.kind == "fileExists"))
                {
                	
                    params[constraint.ident].push(constraint.value);
                    params[constraint.ident].push(constraint.altvalue);
                }
                
            else if ((constraint.ident == "filePath") && ( constraint.kind == "fileWithContent"))
                {	
                	if(params[constraint.ident].indexOf(constraint.value) == -1)
                    	params[constraint.ident].push(constraint.value);
                }
                
            else {
				if(constraint[property] != undefined && constraint[property] != false)
					params[constraint.ident].push(constraint[property]);// = constraint[property];//change
			}
			
		}
	}
}


function generateTestCases()
{

	var content = "var mystery = require('./mystery.js')\nvar mock = require('mock-fs');\n";
	for ( var funcName in functionConstraints )
	{

		var params = initalizeParams(functionConstraints[funcName])
		var altparams = initalizeParams(functionConstraints[funcName])
		var constraints = functionConstraints[funcName].constraints;
		var fileWithContent = _.some(constraints, {kind: 'fileWithContent' });
		var pathExists      = _.some(constraints, {kind: 'fileExists' });
		fillParams(constraints,params,"value")
		fillParams(constraints,params,"altvalue")
		var args = ""
		var result = [];
		Object.keys(params).forEach(function(k) {
    		result.push(params[k])
		});
		args = product(result)
		for(var m = 0; m < args.length;m++)
		{
		
			if( pathExists || fileWithContent)
			{
				console.log("pathExists ",pathExists,"fileWithContent ",fileWithContent,"funcName ",funcName, "args[m] ", args[m])
					content += generateMockFsTestCases(pathExists,fileWithContent,funcName, args[m]);
					// Bonus...generate constraint variations test cases....
					content += generateMockFsTestCases('" "',fileWithContent,funcName, args[m]);
					content += generateMockFsTestCases(pathExists,'" "',funcName, args[m]);
					content += generateMockFsTestCases("' '","' '",funcName, args[m]);
					content += generateMockFsTestCases(pathExists,fileWithContent,funcName, args);
					// Bonus...generate constraint variations test cases....
					content += generateMockFsTestCases(!pathExists,fileWithContent,funcName, args);
					content += generateMockFsTestCases(pathExists,!fileWithContent,funcName, args);
					content += generateMockFsTestCases(!pathExists,!fileWithContent,funcName, args);
				
			}
			else
			{

				content += "mystery.{0}({1});\n".format(funcName, args[m] );
			}
		}

	}


	fs.writeFileSync('test.js', content, "utf8");

}

function generateMockFsTestCases (pathExists,fileWithContent,funcName,args) 
{
	var testCase = "";
	var mergedFS = {};
	if( pathExists )
	{
		for (var attrname in mockFileLibrary.pathExists) 
			{ 
				
				mergedFS[attrname] = mockFileLibrary.pathExists[attrname]; 
			}
	}
	if( fileWithContent )
	{
		for (var attrname in mockFileLibrary.fileWithContent) { mergedFS[attrname] = mockFileLibrary.fileWithContent[attrname]; }
	}
	
	testCase += 
	"mock(" +
		JSON.stringify(mergedFS)
		+
	");\n";
	testCase += "\tmystery.{0}({1});\n".format(funcName, args );
	testCase+="mock.restore();\n";
	return testCase;
}

function constraints(filePath)
{
   var buf = fs.readFileSync(filePath, "utf8");
	var result = esprima.parse(buf, options);

	traverse(result, function (node) 
	{
		if (node.type === 'FunctionDeclaration') 
		{
			var funcName = functionName(node);
			var params = node.params.map(function(p) {return p.name});

			functionConstraints[funcName] = {constraints:[], params: params};

			traverse(node, function(child)
			{	
				if( child.type === 'BinaryExpression' && child.operator == "==")
				{
					if( child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1)
					{
						var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1])

						functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: rightHand,
								altValue: '\"\"',
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}));
					}
				}

				if(child.type === 'LogicalExpression' && child.operator == "&&")
				{
					if( child.left.type === 'BinaryExpression' && child.left.operator == ">" )
					{
						if( child.left.left.type == 'Identifier' && params.indexOf( child.left.left.name ) > -1)
						{
							var expression = buf.substring(child.left.range[0], child.left.range[1]);
							var rightHand = buf.substring(child.left.right.range[0], child.left.right.range[1])

							functionConstraints[funcName].constraints.push( 
								new Constraint(
								{
									ident: child.left.left.name,
									value: parseInt(rightHand) + 1,
									altvalue: parseInt(rightHand) -1,
									funcName: funcName,
									kind: "integer",
									operator : child.left.operator,
									expression: expression
								}));
						}
					}

					

					if( child.right.type === 'BinaryExpression' && child.right.operator == "<" )
					{
						if( child.right.left.type == 'Identifier' && params.indexOf( child.right.left.name ) > -1)
						{
							var expression = buf.substring(child.right.range[0], child.right.range[1]);
							var rightHand = buf.substring(child.right.right.range[0], child.right.right.range[1])

							functionConstraints[funcName].constraints.push( 
								new Constraint(
								{
									ident: child.right.left.name,
									value: parseInt(rightHand) - 1,
									altvalue: parseInt(rightHand) +1,
									funcName: funcName,
									kind: "integer",
									operator : child.right.operator,
									expression: expression
								}));
						}
					}

				}
				if( child.type === 'BinaryExpression' && child.operator == "==")
				{
					if( child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1)
					{
						// get expression from original source code:
						var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1])

						functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: rightHand,
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}));
					}

					if( child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1)
					{
						// get expression from original source code:
						var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1])

						functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: rightHand,
								altvalue: '\"\"',
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}));
					}

					if ( child.left.type == 'CallExpression' && params.indexOf( child.left.callee.object.name ) > -1 ) 
					{

					 var expression = buf.substring(child.range[0], child.range[1]);
                     var val = ''
                        for (var i=0 ; i<=child.right.value; i++)
                        {
                            if (i != child.right.value)
                            {
                            	val = val + "";
                                
                            }
                            if(i == child.right.value)
                            {
                                val = val + child.left.arguments[0].value;
                            }
                        }
                        
                        functionConstraints[funcName].constraints.push( 
                            new Constraint(
                            {
                                ident: child.left.callee.object.name,
                                value: "'"+ val + "'",
                                altvalue: "''",
                                funcName: funcName,
                                kind: "integer",
								operator : child.operator,
								expression: expression
                            }));    

				}


				}


				

				if( child.type === 'BinaryExpression' && child.operator == "!=")
				{
					if( child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1)
					{
						// get expression from original source code:
						var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1])

						functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: rightHand,
								altvalue: "'llllllllll'",
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}));
					}
				}

				if( child.type === 'BinaryExpression' && child.operator == ">" )
				{
					if( child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1)
					{
						// get expression from original source code:
						var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1])

						functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: parseInt(rightHand) + 1,
								altvalue: parseInt(rightHand) -1,
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}));
					}
				}

				if( child.type === 'BinaryExpression' && child.operator == "<" )
				{
					if( child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1)
					{
						// get expression from original source code:
						var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1])

						functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: parseInt(rightHand) - 1,
								altvalue: parseInt(rightHand) +1,
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}));
					}


				}

				
				if( child.type == "CallExpression" && child.callee.property && child.callee.property.name =="readdirSync" )
			   	{
				   for( var p =0; p < params.length; p++ )
				   {
					   if( child.arguments[0].name == params[p] )
					   {
						   functionConstraints[funcName].constraints.push( 
						   new Constraint(
						   {
							   ident: params[p],
							   value:  "'path/fileExists'",
							   altvalue: "'path/dir'",
							   funcName: funcName,
							   kind: "fileExists",
							   operator : child.operator,
							   expression: expression
						   }));
						  
					   }
				   }
			   }
               
				if( child.type == "CallExpression" && child.callee.property && child.callee.property.name =="readFileSync" )
				{
					for( var p =0; p < params.length; p++ )
					{
						if( child.arguments[0].name == params[p] )
						{
							functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: params[p],
								value:  "'pathContent/txt1.txt'",
								funcName: funcName,
								kind: "fileWithContent",
								operator : child.operator,
								expression: expression
							}));

						    functionConstraints[funcName].constraints.push( 
								new Constraint(
								{
									ident: params[p],
									value:  "'pathContent/txt2.txt'",
									altvalue: "'pathContent/txt1.txt'",
									funcName: funcName,
									kind: "fileWithContent",
									operator : child.operator,
									expression: expression
								}));
						}
					}
				}

				if( child.type == "CallExpression" &&
					 child.callee.property &&
					 child.callee.property.name =="existsSync")
				{
					for( var p =0; p < params.length; p++ )
					{
						
						
						    if(child.arguments.name=="filePath"){
							functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: params[p],
								// A fake path to a file
								value:   "'pathContent/txt1.txt'",
								altvalue: "'pathContent/txt2.txt'",
								funcName: funcName,
								kind: "fileWithContent",
								operator : child.operator,
								expression: expression
							}));
						
						}

							if(child.arguments.name=="dir")
							{
								functionConstraints[funcName].constraints.push( 
								new Constraint(
								{
									ident: params[p],
									value:   "'path/fileExists'",
									altvalue: "'path/dir'",
									funcName: funcName,
									kind: "fileExists",
									operator : child.operator,
									expression: expression
								}));
							
							}

						}
					
					}
				
				if( child.type == "BlockStatement" && child.body[0].type == "VariableDeclaration" && child.body[0].declarations[0].type == "VariableDeclarator"
					 && child.body[0].declarations[0].init.type == "CallExpression" && child.body[0].declarations[0].init.callee.name == "format" && child.body[0].declarations[0].init.arguments[0].name == "phoneNumber")
				{
					for( var p =0; p < params.length; p++ )
					{
						if( child.body[0].declarations[0].init.arguments[0].name == params[p] )
						{
							functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: params[p],
								value: '\"'+faker.phone.phoneNumberFormat()+'\"',
								altvalue: '\"'+child.body[2].test.right.value+'9999999\"',
								funcName: funcName,
								kind: "phoneNumber",
								operator : child.operator,
								expression: expression
							}));
						}
					}
					
				}

			

				if( child.type == "AssignmentExpression" &&
					 child.left.name == "phoneNumber" )
		
					for( var p =0; p < params.length; p++ )
					{
						if( child.left.name == params[p] )
						{
							functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: params[p],
								value: '\"'+faker.phone.phoneNumberFormat()+'\"',
								altvalue: '\"111111111111\"',
								funcName: funcName,
								kind: "String",
								operator : child.operator,
								expression: expression
							}));
						}
					}

					if( child.type == "LogicalExpression" && child.left.type == "UnaryExpression" &&
					 child.left.operator == "!" && child.left.argument.name == "options" )
		
					for( var p =0; p < params.length; p++ )
					{
						if( child.left.argument.name == params[p] )
						{
							functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: params[p],
								value: "{normalize:true}",
								altvalue: "null",
								funcName: funcName,
								kind: "String",
								operator : child.operator,
								expression: expression
							}));
						}
					}
				
				

				if( child.type == "AssignmentExpression" &&
					 child.left.name == "formatString" )
		
					for( var p =0; p < params.length; p++ )
					{
						if( child.left.name == params[p] )
						{
							functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: params[p],
								value: '\"dqdwa\"',
								altvalue: '\"sqadsqad\"',
								funcName: funcName,
								kind: "String",
								operator : child.operator,
								expression: expression
							}));
						}
					}

					if( child.type == "MemberExpression" && 
					 child.object.name == "phoneNumber" )
		
					for( var p =0; p < params.length; p++ )
					{
						if( child.object.name == params[p] )
						{
							functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: params[p],
								value: '\"'+faker.phone.phoneNumberFormat()+'\"',
								altvalue: '\"89888888888\"',
								funcName: funcName,
								kind: "String",
								operator : child.operator,
								expression: expression
							}));
						}
					}
				

			});

		

			console.log( functionConstraints[funcName]);

		}
	});
}

function traverse(object, visitor) 
{
    var key, child;

    visitor.call(null, object);
    for (key in object) {
        if (object.hasOwnProperty(key)) {
            child = object[key];
            if (typeof child === 'object' && child !== null) {
                traverse(child, visitor);
            }
        }
    }
}

function traverseWithCancel(object, visitor)
{
    var key, child;

    if( visitor.call(null, object) )
    {
	    for (key in object) {
	        if (object.hasOwnProperty(key)) {
	            child = object[key];
	            if (typeof child === 'object' && child !== null) {
	                traverseWithCancel(child, visitor);
	            }
	        }
	    }
 	 }
}

function functionName( node )
{
	if( node.id )
	{
		return node.id.name;
	}
	return "";
}


if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) { 
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };
}

main();
exports.main = main;
