
/*
Example of the returned HTML for a Google Doc

<html>

  <head>
    <title>new note</title>
    <meta content="text/html; charset=UTF-8" http-equiv="content-type">
    <style type="text/css">
      ul.lst-kix_2ikynbjih8vn-8
      {
        list-style-type:none
      }
      ul.lst-kix_2ikynbjih8vn-0
      {
        list-style-type:none
      }
      .lst-kix_2ikynbjih8vn-3>li:before
      {
        content:"\0025cf  "
      }
      ul.lst-kix_2ikynbjih8vn-7
      {
        list-style-type:none
      }
      ul.lst-kix_2ikynbjih8vn-6
      {
        list-style-type:none
      }
      ul.lst-kix_2ikynbjih8vn-5
      {
        list-style-type:none
      }
      ul.lst-kix_2ikynbjih8vn-4
      {
        list-style-type:none
      }
      .lst-kix_2ikynbjih8vn-0>li:before
      {
        content:"\0025cf  "
      }
      ul.lst-kix_2ikynbjih8vn-3
      {
        list-style-type:none
      }
      .lst-kix_2ikynbjih8vn-8>li:before
      {
        content:"\0025a0  "
      }
      .lst-kix_2ikynbjih8vn-7>li:before
      {
        content:"\0025cb  "
      }
      ul.lst-kix_2ikynbjih8vn-2
      {
        list-style-type:none
      }
      ul.lst-kix_2ikynbjih8vn-1
      {
        list-style-type:none
      }
      .lst-kix_2ikynbjih8vn-2>li:before
      {
        content:"\0025a0  "
      }
      .lst-kix_2ikynbjih8vn-6>li:before
      {
        content:"\0025cf  "
      }
      .lst-kix_2ikynbjih8vn-5>li:before
      {
        content:"\0025a0  "
      }
      .lst-kix_2ikynbjih8vn-4>li:before
      {
        content:"\0025cb  "
      }
      .lst-kix_2ikynbjih8vn-1>li:before
      {
        content:"\0025cb  "
      }
      ol
      {
        margin:0;padding:0
      }
      .c0
      {
        line-height:1.0;
        padding-top:0pt;
        height:11pt;
        text-align:left;
        direction:ltr;
        padding-bottom:0pt
      }
      .c3
      {
        line-height:1.0;
        padding-top:0pt;
        text-align:left;
        direction:ltr;
        padding-bottom:0pt
      }
      .c4
      {
        max-width:468pt;
        background-color:#ffffff;
        padding:72pt 72pt 72pt 72pt
      }
      .c1
      {
        direction:ltr;
        margin-left:72pt
      }
      .c10
      {
        margin:0;
        padding:0
      }
      .c5
      {
        height:11pt;
        direction:ltr
      }
      .c8
      {
        padding-left:0pt;
        margin-left:36pt
      }
      .c9
      {
        margin-left:36pt
      }
      .c6
      {
        font-style:italic
      }
      .c7
      {
        font-weight:bold
      }
      .c2
      {
        color:#ff0000
      }
      .title
      {
        padding-top:24pt;
        line-height:1.0;
        text-align:left;
        color:#000000;
        font-size:36pt;
        font-family:"Arial";
        font-weight:bold;
        padding-bottom:6pt;
        page-break-after:avoid
      }
      .subtitle
      {
          padding-top:18pt;
          line-height:1.0;
          text-align:left;
          color:#666666;
          font-style:italic;
          font-size:24pt;
          font-family:"Georgia";
          padding-bottom:4pt;
          page-break-after:avoid
      }
        li
        {
          color:#000000;
          font-size:11pt;
          font-family:"Arial"
        }
        p
        {
          color:#000000;
          font-size:11pt;
          margin:0;
          font-family:"Arial"
        }
        h1
        {
          padding-top:12pt;
          line-height:1.0;
          text-align:left;
          color:#000000;
          font-size:24pt;
          font-family:"Arial";
          font-weight:bold;
          padding-bottom:12pt
        }
        h2
        {
          padding-top:11.2pt;line-height:1.0;text-align:left;color:#000000;font-size:18pt;font-family:"Arial";font-weight:bold;padding-bottom:11.2pt
        }
        h3
        {
          padding-top:12pt;line-height:1.0;text-align:left;color:#000000;font-size:14pt;font-family:"Arial";font-weight:bold;padding-bottom:12pt
        }
        h4
        {
          padding-top:12.8pt;line-height:1.0;text-align:left;color:#000000;font-size:12pt;font-family:"Arial";font-weight:bold;padding-bottom:12.8pt
        }
        h5
        {
          padding-top:12.8pt;line-height:1.0;text-align:left;color:#000000;font-size:9pt;font-family:"Arial";font-weight:bold;padding-bottom:12.8pt
        }
        h6
        {
          padding-top:18pt;line-height:1.0;text-align:left;color:#000000;font-size:8pt;font-family:"Arial";font-weight:bold;padding-bottom:18pt
        }
    </style>
  </head>

  <body class="c4">
    <p class="c3">
      <span class="c7">new</span><span>&nbsp;note</span>
    </p>

    <p class="c0"><span></span></p>

    <ul class="c10 lst-kix_2ikynbjih8vn-0 start">
      <li class="c3 c8"><span>test</span></li>
    </ul>

    <p class="c0"><span></span></p>

    <p class="c3 c9"><span class="c6">indented</span></p>

    <p class="c5"><span></span></p>

    <p class="c1"><span>indented2</span></p><hr>

    <p class="c0 c9"><span></span></p>

    <p class="c3"><span>not </span><span class="c2">indented</span></p>

    <p class="c0"><span></span></p>
  </body>

</html>
*/

// thoughts
// - extract body tag content
// - extract style tag content and parse ignoring all that dont match the pattern ".c*", use jquery to create new style element
//   to insert all matching into


function cleanGoogleDocHTML(html)
{
  var styles = extractContentOfElement('style');
  var body = extractContentOfElement('body');

  body = body
       .replace(/<p/g, '<div')
       .replace(/<\/p>/g, '</div>');

  var $body = $(body);

  $body.find('*').each(function()
  {
    var classes = this.className.split(/\s+/);

    $.each(classes, function(i, c)
    {
        if(c.indexOf('c') !== 0)
        {
            $(this).removeClass(c);
        }
    }
  });

  return $body.html();
}


function extractContentOfElement(elementName)
{

}
