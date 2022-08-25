
var documents = [{
    "id": 0,
    "url": "http://localhost:4000/404.html",
    "title": "404",
    "body": "404 Page does not exist!Please use the search bar at the top or visit our homepage! "
    }, {
    "id": 1,
    "url": "http://localhost:4000/about",
    "title": "About",
    "body": "This website is built with Jekyll and Mediumish template for Jekyll. It's for demonstration purposes, no real content can be found. Mediumish template for Jekyll is compatible with Github pages, in fact even this demo is created with Github Pages and hosted with Github.  Found something that looks off?: Head over to the Github repository! Links	This blog would neither look this good, nor contain any interesting articles if it wasn't for Mediumish and HomeAssistant. Mediumish HomeAssistant"
    }, {
    "id": 2,
    "url": "http://localhost:4000/categories",
    "title": "Categories",
    "body": ""
    }, {
    "id": 3,
    "url": "http://localhost:4000/",
    "title": "Home",
    "body": "      Featured:                     All Stories:                                                                                                     Coffee counter              :       Coffee counter:                                                                               Miicroo                17 Apr 2020                                            "
    }, {
    "id": 4,
    "url": "http://localhost:4000/robots.txt",
    "title": "",
    "body": "      Sitemap: {{ “sitemap. xml”   absolute_url }}   "
    }, {
    "id": 5,
    "url": "http://localhost:4000/coffee-counter/",
    "title": "Coffee counter",
    "body": "2020/04/17 - Coffee counter PSA: This is not really a custom component in homeassistant, but rather a way of achieving the behaviour of a counter that resets daily. Background: I am Swedish, so here it is custom to drink a lot of coffee. I also work in an office, meaning that I drink even more coffee. To get a grip on exactly how many cups a day it actually amounts to, I decided to track it with the help of homeassistant. Implementation: To implement the coffee counter we are going to use the new webhook api together with a simple input_number and a set of automations. Setup input_number: We will begin by setting up a simple input_number to serve as our counter. To specify a range, we assume that we drink no less than 0 cups of coffee, and no more than 25 (though to be fair it would be quite extreme to be even near 25 cups per day). Add the following to your configuration. yaml: 123456789input_number: coffee_counter:  name: Coffee counter  initial: 0  min: 0  max: 25  step: 1  mode: box  unit_of_measurement: cupsListen to incoming webhook: The webhook api was added in homeassistant 0. 80 and provides a simple entry point to trigger an automation. You do not need to authenticate your requests, but to make it harder for potential attackers your webhook id should be a long random string. For the sake of clarity we will use a short webhook id, but it should be replaced in a real setup. Add an automation with the following webhook trigger: 123456789- alias: Increment coffee counter trigger:  platform: webhook  webhook_id: coffee action:  service: input_number. set_value  data_template:   entity_id: input_number. coffee_counter   value:  1 Now we have set up our homeassistant to trigger each time we do a POST request with Content-Type: application/json to our endpoint at http://example-ha. duckdns. org:8123/api/webhook/coffee. Reset at midnight: It is hard to see how many cups of coffee you drink each day if the value never resets. Thus we will add another automation that sets the counter to 0 every day at midnight. Add a new automation with the following content: 123456789- alias: Reset coffee counter trigger:  platform: time  at: '00:00:00' action:  service: input_number. set_value  data_template:   entity_id: input_number. coffee_counter   value: 0Add counter to UI: To give a good overview of our typical coffee consumption we can add a history graph card showing the past 5 days (note: you have to use lovelace as default UI in homeassistant). In ui-lovelace. yaml, add: 12345- type: history-graph entities:  - input_number. coffee_counter title: Coffees hours_to_show: 120Add support for mobile: No system is complete without an easy-to-use interface, and it would be a shame if we had to log on to the homeassistant account every time we wanted to log a new cup of coffee. Instead we will be using a mobile app which lets us instantly increment the counter with a click of an icon. I am currently using HTTP Shortcuts (which is also open source) to generate an icon on my home screen. To configure HTTP shortcuts, first add a new shortcut named Coffee (or anything else if you want). Make sure that it is sending a POST to your webhook api endpoint:  Make sure that the shortcut sends the Content-Type-header with value application/json, and add an empty body that is still valid json (for instance {}). I have also chosen to be notified of the response via a toast:  Finally, the advanced settings can be left as default:  When the shortcut is saved, longpress on the name in the app and choose Place on home screen to get a nice clickable icon just a thumb away!  Result: The result is a really easy to use shortcut which produces a chart showing the amount of coffee you drink every day.   "
    }];

var idx = lunr(function () {
    this.ref('id')
    this.field('title')
    this.field('body')

    documents.forEach(function (doc) {
        this.add(doc)
    }, this)
});
function lunr_search(term) {
    document.getElementById('lunrsearchresults').innerHTML = '<ul></ul>';
    if(term) {
        document.getElementById('lunrsearchresults').innerHTML = "<p>Search results for '" + term + "'</p>" + document.getElementById('lunrsearchresults').innerHTML;
        //put results on the screen.
        var results = idx.search(term);
        if(results.length>0){
            //console.log(idx.search(term));
            //if results
            for (var i = 0; i < results.length; i++) {
                // more statements
                var ref = results[i]['ref'];
                var url = documents[ref]['url'];
                var title = documents[ref]['title'];
                var body = documents[ref]['body'].substring(0,160)+'...';
                document.querySelectorAll('#lunrsearchresults ul')[0].innerHTML = document.querySelectorAll('#lunrsearchresults ul')[0].innerHTML + "<li class='lunrsearchresult'><a href='" + url + "'><span class='title'>" + title + "</span><br /><span class='body'>"+ body +"</span><br /><span class='url'>"+ url +"</span></a></li>";
            }
        } else {
            document.querySelectorAll('#lunrsearchresults ul')[0].innerHTML = "<li class='lunrsearchresult'>No results found...</li>";
        }
    }
    return false;
}

function lunr_search(term) {
    $('#lunrsearchresults').show( 400 );
    $( "body" ).addClass( "modal-open" );
    
    document.getElementById('lunrsearchresults').innerHTML = '<div id="resultsmodal" class="modal fade show d-block"  tabindex="-1" role="dialog" aria-labelledby="resultsmodal"> <div class="modal-dialog shadow-lg" role="document"> <div class="modal-content"> <div class="modal-header" id="modtit"> <button type="button" class="close" id="btnx" data-dismiss="modal" aria-label="Close"> &times; </button> </div> <div class="modal-body"> <ul class="mb-0"> </ul>    </div> <div class="modal-footer"><button id="btnx" type="button" class="btn btn-danger btn-sm" data-dismiss="modal">Close</button></div></div> </div></div>';
    if(term) {
        document.getElementById('modtit').innerHTML = "<h5 class='modal-title'>Search results for '" + term + "'</h5>" + document.getElementById('modtit').innerHTML;
        //put results on the screen.
        var results = idx.search(term);
        if(results.length>0){
            //console.log(idx.search(term));
            //if results
            for (var i = 0; i < results.length; i++) {
                // more statements
                var ref = results[i]['ref'];
                var url = documents[ref]['url'];
                var title = documents[ref]['title'];
                var body = documents[ref]['body'].substring(0,160)+'...';
                document.querySelectorAll('#lunrsearchresults ul')[0].innerHTML = document.querySelectorAll('#lunrsearchresults ul')[0].innerHTML + "<li class='lunrsearchresult'><a href='" + url + "'><span class='title'>" + title + "</span><br /><small><span class='body'>"+ body +"</span><br /><span class='url'>"+ url +"</span></small></a></li>";
            }
        } else {
            document.querySelectorAll('#lunrsearchresults ul')[0].innerHTML = "<li class='lunrsearchresult'>Sorry, no results found. Close & try a different search!</li>";
        }
    }
    return false;
}
    
$(function() {
    $("#lunrsearchresults").on('click', '#btnx', function () {
        $('#lunrsearchresults').hide( 5 );
        $( "body" ).removeClass( "modal-open" );
    });
});