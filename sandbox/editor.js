

(function ($) {
    $.fn.wysiwygEvt = function () {
        return this.each(function () {
            var $this = $(this);
            var htmlold = $this.html();
            $this.bind('blur keyup paste copy cut mouseup', function () {
                var htmlnew = $this.html();
                if (htmlold !== htmlnew) {
                    $this.trigger('change')
                }
            })
        })
    }
})(jQuery);


function Editor()
{

}

Editor.prototype.setup = function(elem_editor, elem_toolbar)
{
    elem_editor.wysiwygEvt();

    elem_editor.on('change', function()
    {
        $('.content').text( elem_editor.html() );
    });

    elem_editor.attr('contenteditable', true);

    var buttons = elem_toolbar.children('button[data-tag]');

    buttons.each(function(i)
    {
        $(this).on('click', function(e)
        {
            var tag = $(this).attr('data-tag');

            document.execCommand(tag, false, $(this).attr('data-value'));

            elem_editor.trigger('change');

            e.preventDefault();
        });
    });
};
