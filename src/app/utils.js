
$.fn.center = function ()
{
    this.css("position","absolute");
    this.css("top", ( this.parent().height() - this.height() ) / 2  + "px");
    this.css("left", ( this.parent().width() - this.width() ) / 2 + "px");
    return this;
};

jQuery.fn.cssFloat = function(prop) {
    return parseFloat(this.css(prop)) || 0;
};


var guid = (function() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return function() {
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
            s4() + '-' + s4() + s4() + s4();
    };
})();


if(typeof String.prototype.startsWith != 'function')
{
    String.prototype.startsWith = function (str){
        return this.slice(0, str.length) == str;
    };
}


function contentOfFirstOf(tags, text)
{
    var first_tag = null;
    var first_index = -1;

    tags.forEach( function(tag)
    {
        var start_open_tag = '<'+tag;
        var start_open_index = text.indexOf(start_open_tag);

        if(start_open_index > first_index)
        {
            first_tag = tag;
            first_index = start_open_index;
        }
    });

    if(first_tag)
    {
        return contentOfFirstTag(first_tag, text);
    }
    else
        return null;
}


function contentUntilFirstOf(tags, text)
{
    var first_tag = null;
    var first_index = -1;

    tags.forEach( function(tag)
    {
        var start_open_tag = '<'+tag;
        var start_open_index = text.indexOf(start_open_tag);

        if(start_open_index > first_index)
        {
            first_tag = tag;
            first_index = start_open_index;
        }
    });

    if(first_tag)
    {
        return contentUntilTag(first_tag, text);
    }
    else
        return null;
}


function contentOfFirstTag(tag, text, startFromIndex)
{
    var start_open_tag = '<'+tag;
    var start_close_tag = '>';
    var end_tag = '</'+tag+'>';

    var start_open_index = text.indexOf(start_open_tag, startFromIndex);
    var start_close_index = text.indexOf(start_close_tag, start_open_index);
    var end_index = text.indexOf(end_tag, start_close_index);

    if(start_open_index < 0)
        return null;

    return text.substring(start_close_index+start_close_tag.length, end_index);
}


function contentUntilTag(tag, text, startFromIndex)
{
    var start_open_tag = '<'+tag;

    var start_open_index = text.indexOf(start_open_tag, startFromIndex);

    if(start_open_index < 0)
        return text;

    return text.substring(0, start_open_index);
}


function stripTags(text)
{
    var stripped = text;

    while(true)
    {
        var start_index = stripped.indexOf('<');
        var end_index = stripped.indexOf('>', start_index);

        if(end_index > 0)
            end_index += 1; // ie. '>' character

        if(end_index >= stripped.length)
            end_index = -1;

        if(start_index >= 0) {
            stripped = removeRange(stripped, start_index, end_index);
        }

        if(start_index < 0 || end_index < 0)
            break;
    }

    return stripped;
}


function removeRange(s, start, end)
{
    var result = s.substring(0, start);

    if(end >= 0)
        result += s.substring(end);

    return result;
}


function stripTag(tag, from)
{
    var start_tag = '<'+tag;
    var end_tag = '</'+tag+'>';

    var start_index = from.indexOf(start_tag);
    var end_index = from.indexOf(end_tag);

    if(start_index >= 0 && end_index >= 0)
    {
        return from.substring(0, start_index) + from.substring(end_index + end_tag.length);
    }
    else if(start_index >= 0)
    {
        end_tag = '>';
        end_index = from.indexOf('>', start_index);

        if(end_index)
            return from.substring(0, start_index) + from.substring(end_index + end_tag.length);
    }

    return from;
}


function arrayContains(needle, arrhaystack)
{
    return (arrhaystack.indexOf(needle) > -1);
}
