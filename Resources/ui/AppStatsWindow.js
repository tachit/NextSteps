var AD = require('AppDev');
var $ = require('jquery');

var ViewTotalsWindow = $.Window('AppDev.UI.ViewTotalsWindow', {}, {
    init: function(options) {
        // Initialize the base $.Window object
        this._super({
            title: 'viewTotalsTitle',
            tab: options.tab,
            autoOpen: true
        });
    },
    
    // Create the child views
    create: function() {
        // Create the scrollable stats container
        var $statsView = new StatsView({
            lastUpdatePropertyName: 'lastStatsReset' // a property in AD.PropertyStore
        });
        this.add('statsView', $statsView);
    }
});

// Create a stats container, complete with a header label and footer view
var StatsView = $.View('AppDev.UI.StatsView', {}, {
    init: function(options) {
        this.footerPresent = typeof this.options.footerHeight !== 'undefined';
        this.footerHeight = this.footerPresent ? this.options.footerHeight : 0;
        
        // Create the stats containing view
        var statsView = Ti.UI.createView({
            width: AD.UI.screenWidth
        });
        
        // The stats view is the view's view
        this._super({view: statsView});
        
        this.smartBind(AD.Models.Contact, 'updated', this.update);
    },
    
    // Create the child views
    create: function() {
        // Create the header label
        this.add('headerLabel', Ti.UI.createLabel({
            top: AD.UI.padding,
            left: AD.UI.padding,
            width: Ti.UI.SIZE,
            height: Ti.UI.SIZE,
            text: '',
            font: AD.UI.Fonts.header
        }));
        
        // Create the scrollable stats container
        this.add('statsTable', $.View.create(Ti.UI.createScrollView({
            left: 0,
            top: 50,
            width: AD.UI.screenWidth,
            height: Ti.UI.SIZE,
            scrollType: 'vertical',
            contentHeight: Ti.UI.SIZE,
            showVerticalScrollIndicator: true
        })));
        
        if (this.footerPresent) {
            // Create the abstract footer view
            this.add('footerView', Ti.UI.createView({
                bottom: AD.UI.padding,
                left: 0,
                width: AD.UI.screenWidth,
                height: this.footerHeight
            }));
        }
    },
    
    // Initialize the child views
    initialize: function() {
        this.update();
    },
    
    // Update the window's contents
    update: function() {
        var startDateString = AD.PropertyStore.get(this.options.lastUpdatePropertyName);
        var startDate = startDateString ? new Date(parseInt(startDateString, 10)) : null;
        var headerText = startDate ? $.formatString('statsHeaderSince', $.formatDate(startDate)) : AD.Localize('statsHeaderEver');
        var headerHeight = startDate ? 60 : 30;
        this.getChild('headerLabel').text = headerText;
        
        var $statsTable = this.get$Child('statsTable');
        var statsTable = $statsTable.getView();
        statsTable.top = headerHeight + AD.UI.padding;
        statsTable.bottom = this.footerHeight + AD.UI.padding * 2;
        
        // Create the stats rows, one for each step
        var stats = AD.Models.Contact.getStats(startDate, null);
        var statRowIndex = 0;
        $.each(AD.Models.Contact.steps, function(stepName, stepFieldName) {
            $statsTable.add(new StatRow({
                index: statRowIndex,
                label: 'step_'+stepName,
                count: stats[stepFieldName]
            }));
            statRowIndex += 1;
        });
    }
});

var StatRow = $.View('AppDev.UI.StatRow', {
    rowHeight: 30,
    font: AD.UI.Fonts.medium
}, {
    init: function(options) {
        // Create the stat row containing view
        var rowView = Ti.UI.createView({
            top: this.options.index * this.constructor.rowHeight,
            left: AD.UI.padding,
            width: AD.UI.useableScreenWidth,
            height: this.constructor.rowHeight,
            backgroundColor: (this.options.index % 2 === 0) ? 'white' : '#CCC' // alternate background colors
        });
        
        // The row is the view's view
        this._super({view: rowView});
    },
    
    // Create the child views
    create: function() {
        var font = this.constructor.font;
        this.add(Ti.UI.createLabel({
            left: 0,
            text: (this.options.index + 1) + '.',
            font: font
        }));
        this.add(Ti.UI.createLabel({
            left: 40,
            textid: this.options.label,
            font: font
        }));
        this.add(Ti.UI.createLabel({
            right: 0,
            text: this.options.count,
            font: font
        }));
    }
});

module.exports = $.Window('AppDev.UI.AppStatsWindow', {
    actions: [{
        title: 'reset',
        rightNavButton: true,
        callback: function() {
            AD.PropertyStore.remove(this.constructor.lastUpdatePropertyName);
            this.get$Child('statsView').update();
            this.getChild('viewTotals').visible = false;
        },
        enabled: AD.Defaults.development
    }],
    
    lastUpdatePropertyName: 'lastStatsReport' // a property in AD.PropertyStore
}, {
    init: function(options) {
        // Initialize the base $.Window object
        this._super({
            title: 'statsTitle',
            tab: options.tab
        });
    },
    
    // Create the child views
    create: function() {
        var $statsView = this.add('statsView', new StatsView({
            footerHeight: AD.UI.buttonHeight,
            lastUpdatePropertyName: this.constructor.lastUpdatePropertyName
        }));
        
        var headerLabel = $statsView.children.headerLabel;
        var statsTable = $statsView.children.statsTable;
        var footerView = $statsView.children.footerView;
        var tab = this.tab;
        
        // Create the view totals button
        var viewTotalsButton = this.record('viewTotals', Ti.UI.createButton({
            top: 0,
            left: AD.UI.padding,
            width: AD.UI.screenWidth / 2 - AD.UI.padding * 2,
            height: AD.UI.buttonHeight,
            titleid: 'viewTotals',
            visible: AD.PropertyStore.get(this.constructor.lastUpdatePropertyName) ? true : false
        }));
        viewTotalsButton.addEventListener('click', function(event) {
            var winViewTotals = new ViewTotalsWindow({tab: tab});
        });
        footerView.add(viewTotalsButton);
        
        // Create the save button
        var saveButton = Ti.UI.createButton({
            top: 0,
            right: AD.UI.padding,
            width: AD.UI.screenWidth / 2 - AD.UI.padding * 2,
            height: AD.UI.buttonHeight,
            titleid: 'saveStats'
        });
        saveButton.addEventListener('click', this.proxy('save'));
        footerView.add(saveButton);
    },
    
    save: function() {
        var sendStatsReportEmail = Ti.App.Properties.getBool('send_stats_email_preference');
        AD.UI.yesNoAlert(sendStatsReportEmail ? 'statsConfirmSubmit' : 'statsConfirmSave').done(this.proxy(function() {
            var today = $.today();
            var yesterday = $.today();
            yesterday.setDate(today.getDate() - 1);
            var lastStatsReport = AD.PropertyStore.get(this.constructor.lastUpdatePropertyName);
            
            // Update the lastStatsReport property to the current date and the stats view to reflect the change
            AD.PropertyStore.set(this.constructor.lastUpdatePropertyName, today.getTime());
            this.get$Child('statsView').update();
            this.getChild('viewTotals').visible = true;
            
            // Possibly send a stats report email to the address set in preferences
            if (sendStatsReportEmail) {
                var stats = AD.Models.Contact.getStats(lastStatsReport, yesterday);
                var steps = '';
                $.each(AD.Models.Contact.steps, function(stepName, stepFieldName) {
                    var statLabel = AD.Localize('step_'+stepName);
                    var statValue = stats[stepFieldName];
                    var line = statLabel+': '+statValue;
                    steps += line+'\n';
                });
                var messageBody = $.formatString('statsMessageBody', Ti.Platform.username, $.formatDate(today), steps);
                Ti.API.log(messageBody);
                
                var address = Ti.App.Properties.getString('send_stats_email_address_preference');
                var emailDialog = Ti.UI.createEmailDialog({
                    toRecipients: [address],
                    subject: 'Stats Report from "'+Ti.Platform.username+'"',
                    messageBody: messageBody
                });
                emailDialog.open();
                // Do not actually send the e-mail until the AppDev e-mail service is fully implemented
                /*
                AD.ServiceJSON.post({
                    url: '/site/email/send',
                    params: {
                        to: address,
                        subject: $.formatDate(today)+' Stats Report',
                        body: messageBody
                    },
                    success: function(data) {
                        alert('Stats report email successfully sent!');
                    },
                    failure: function(data) {
                        alert('Stats report email failed to send!');
                    }
                });
                */
            }
        }));
    }
});
