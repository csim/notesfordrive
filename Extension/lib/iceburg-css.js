
/*
 Iceburg CSS
 Author: Elijah Sheppard

 A super simple css parser.
 */

function IceburgCSS(cssText)
{
    this._ruleSets = this.process(cssText);

    this.__defineGetter__('ruleSets', function() {
        return this._ruleSets;
    });

    this.__defineSetter__('ruleSets', function(rs) {
        this._ruleSets = rs;
    });
}


IceburgCSS.prototype.process = function(cssText)
{
    // selector is everything from start of rule reading until '{',
    // property is everything until ':',
    // value is everything until either ';' or '}'

    function readDeclaration(block)
    {
        var openIndex = block.text.indexOf(':', block.position);
        var closeIndex = block.text.indexOf(';', block.position);

        if(openIndex < 0)
            return null;

        if(closeIndex < 0)
            closeIndex = block.text.length;

        var property = block.text.substring(block.position, openIndex).trim();
        block.position = openIndex + 1;

        var value = block.text.substring(block.position, closeIndex).trim();

        if(closeIndex >= 0)
            block.position = closeIndex + 1;

        return {
            property: property,
            value: value
        }
    }

    function readRule(block)
    {
        var openIndex = block.text.indexOf('{', block.position);
        var closeIndex = block.text.indexOf('}', block.position);

        if(openIndex < 0)
            return null;

        var selector = block.text.substring(block.position, openIndex).trim();

        var declarationsBlock = {
            text: block.text.substring(openIndex+1, closeIndex).trim(),
            position: 0
        };

        var declarationSet = [];

        while(declarationsBlock.position < declarationsBlock.text.length)
        {
            var decl = readDeclaration(declarationsBlock);

            if(decl)
                declarationSet.push(decl);
            else
                break;
        }

        block.position = closeIndex + 1;

        return {
            selector: selector,
            declarations: declarationSet
        }
    }

    var processingBlock = {
        text: cssText,
        position: 0
    };

    var ruleSet = [];
    while(processingBlock.position < processingBlock.text.length)
    {
        var rule = readRule(processingBlock);

        if(rule)
            ruleSet.push(rule);
        else
            break;
    }

    return ruleSet;
};


IceburgCSS.prototype.cssText = function()
{
    var result = "";

    this._ruleSets.forEach( function(ruleSet)
    {
        result += ruleSet.selector + '{';

        ruleSet.declarations = ruleSet.declarations.filter( function(decl)
        {
            result += decl.property + ':' + decl.value;
        });

        result += "}\r\n";
    });

    return result;
};
