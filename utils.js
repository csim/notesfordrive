
$.fn.center = function ()
{
    this.css("position","absolute");
    this.css("top", ( this.parent().height() - this.height() ) / 2  + "px");
    this.css("left", ( this.parent().width() - this.width() ) / 2 + "px");
    return this;
}
