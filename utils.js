
$.fn.center = function ()
{
    this.css("position","absolute");
    this.css("top", ( this.parent().height() - this.height() ) / 2  + "px");
    this.css("left", ( this.parent().width() - this.width() ) / 2 + "px");
    return this;
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