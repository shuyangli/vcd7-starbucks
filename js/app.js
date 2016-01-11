/*
 * ===================
 *  Object Prototypes
 * ===================
 */

var dummyPrice = 0.33;

var protoSession = {
	currentDrinkSize : "",
	purchasedItems : [],
	netPrice : 0.0,
	taxPrice : 0.0,
	totalPrice : 0.0,
	addItem : function (item) {
		this.purchasedItems.push(item);
		purchasedItemsChanged();
	},
	removeItem : function (itemIndex) {
		this.purchasedItems.splice(itemIndex, 1);
		purchasedItemsChanged();
	}
};

var protoDrink = {
	itemType : "drink",
	itemSize : "",
	itemName : "",
	itemCustomization : [],
	addCustomization : function (item) {
		this.itemCustomization.push(item);
		purchasedItemsChanged();
	},
	removeCustomization : function (itemIndex) {
		this.itemCustomization.splice(itemIndex, 1);
		purchasedItemsChanged();
	},
	getItemDescription : function () {
		return this.itemSize + " " + this.itemName;
	},
	getPrice : function () {
		if (itemPriceData[this.itemType][this.itemSize].hasOwnProperty(this.itemName)) {
			return itemPriceData[this.itemType][this.itemSize][this.itemName];
		} else {
			return dummyPrice;
		}
	}
};

var protoCustomization = {
	itemType : "customization",
	itemName : "",
	getItemDescription : function () {
		return this.itemName;
	},
	getPrice : function () {
		if (itemPriceData[this.itemType].hasOwnProperty(this.itemName)) {
			return itemPriceData[this.itemType][this.itemName];
		} else {
			return dummyPrice;
		}
	}
};

var protoItem = {
	itemType : "item",
	itemName : "",
	getItemDescription : function () {
		return this.itemName;
	},
	getPrice : function () {
		if (itemPriceData[this.itemType].hasOwnProperty(this.itemName)) {
			return itemPriceData[this.itemType][this.itemName];
		} else {
			return dummyPrice;
		}
	}
};

var protoCustomPrice = {
	itemType : "customPrice",
	itemName : "Custom Price",
	customItemPrice : 0,
	getItemDescription : function () {
		return this.itemName;
	},
	getPrice : function () {
		return this.customItemPrice;
	}
};

var protoCardReload = {
	itemType : "cardReload",
	itemName : "Card Reload",
	reloadAmount : 0,
	getItemDescription : function () {
		return this.itemName;
	},
	getPrice : function () {
		return this.reloadAmount;
	}
};

/*
 * =======================
 *  Variable Declarations
 * =======================
 */

// Current session & last session
var currentSession = {};
var lastSession = {};

// User signed in
var baristaName = "John Appleseed";

// Tax rate
var taxRate = 0.07;

// Price
var itemPriceData = {};
$.getJSON("js/item-prices.json", function (data) {
	itemPriceData = data;
});

// For modifying the list
var currentItemIndex = 0;
var currentCustomizationIndex = 0;

// For cell size
var itemCellSize = {
	width : 223,
	height : 64
};
var customizationCellSize = {
	width : 191,
	height : 32
};

// For custom number pads
var customNumPadValue = "0";

/*
 * ======================
 *  Model Helper Methods
 * ======================
 */

// Rolling my own toFixed method
function myToFixed (number, precision) {
    return (Math.round(number * 100) / 100).toFixed(precision);
}

// Manual callback function for changes fired on purchased items
function purchasedItemsChanged() {

	// If there's no item, we reset everything
	if (currentSession.purchasedItems.length == 0) {
		clearCurrentSession();
		return;
	}

	// There's item; we hide the no item prompt
	$("#no-item-prompt").hide();

	// We first clean up the order list
	removeAllItemsFromOrderList();

	// Then loop through the list of purchased items
	var newPrice = 0.0;
	for (var i = 0; i < currentSession.purchasedItems.length; ++i) {

		// Calculate new total and display order list
		var currentItemPrice = currentSession.purchasedItems[i].getPrice();
		var currentItemName = currentSession.purchasedItems[i].getItemDescription();

		newPrice += currentItemPrice;
		addItemIntoOrderList(currentItemName, currentItemPrice, i);

		if (currentSession.purchasedItems[i].itemType == "drink") {
			// If it's a drink, we also loop through its customizations
			for (var j = 0; j < currentSession.purchasedItems[i].itemCustomization.length; ++j) {
				var currentCustomizationPrice = currentSession.purchasedItems[i].itemCustomization[j].getPrice();
				var currentCustomizationName = currentSession.purchasedItems[i].itemCustomization[j].getItemDescription();

				newPrice += currentCustomizationPrice;
				addCustomizationIntoOrderList(currentCustomizationName, currentCustomizationPrice, i, j);
			}
		}
	}

	// Then scroll to the borrom of #order-list
	$("#order-list").scroll();
	$("#order-list").animate({scrollTop : $("#order-list").height()}, 600);

	currentSession.netPrice = newPrice;
	currentSession.taxPrice = currentSession.netPrice * taxRate;
	currentSession.totalPrice = currentSession.netPrice + currentSession.taxPrice;

	displayChargePrice();
}

function clearCurrentSession() {
	currentSession = $.extend(true, {}, protoSession);
	resetOrderBarStatus();
	resetOrderList();
}

function cashUnit(price) {
	if (price < 5) {
		return 1;
	} else if (price <= 25) {
		return 5;
	} else if (price <= 40) {
		return 10;
	} else {
		return 20;
	}
}
function nextCashUnit(unit) {
	if (unit == 1) {
		return 5;
	} else if (unit == 5) {
		return 10;
	} else if (unit == 10) {
		return 20;
	} else if (unit == 20) {
		return 100;
	} else {
		return -1;
	}
}
function cashAmountOne(price) {
	var currentCashUnit = cashUnit(price);
	return (Math.floor(price / currentCashUnit) + 1) * currentCashUnit;
}
function cashAmountTwo(price) {
	var currentCashUnit = cashUnit(price);
	var nextToCurrentCashUnit = nextCashUnit(currentCashUnit);

	var tempAmount = (Math.floor(price / nextToCurrentCashUnit) + 1) * nextToCurrentCashUnit;

	// This is terrible
	if (tempAmount == cashAmountOne(price)) {
		if (nextToCurrentCashUnit == 100) {
			return tempAmount + 20;
		} else {
			nextToCurrentCashUnit = nextCashUnit(nextToCurrentCashUnit);
			tempAmount = (Math.floor(price / nextToCurrentCashUnit) + 1) * nextToCurrentCashUnit;
		}
	}

	return tempAmount;
}

/*
 * ===================
 *  UI Helper Methods
 * ===================
 */

// Display time
function displayInfobox() {
	var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
	var currentDatetime = new Date();

	// Display month + date
	$(".js-date").text(months[currentDatetime.getMonth()] + " " + currentDatetime.getDate());

	// Set "Good morning/afternoon/evening"
	var hour = currentDatetime.getHours();
	$(".js-time-desc").text(
		(hour >= 6 && hour < 12) ? "morning" :
		(hour >= 12 && hour < 18) ? "afternoon" :
		"evening");

	// Display actual hour:minute
	var hourSuffix = hour - 12 < 0 ? "AM" : "PM";
	hour = (hour % 12 == 0) ? 12 : hour % 12;
	var minute = currentDatetime.getMinutes();
	minute = (minute < 10) ? "0" + minute : "" + minute;

	$(".js-time").text(hour + ":" + minute + " " + hourSuffix);

	// Change barista name
	$(".js-preferred-name").text(baristaName);
}

// Display tax or total
function displayTax(decimalVal) {
	$("#js-tax-dollar-amount-display").text("$" + myToFixed(decimalVal, 2));
}

function displayTotal(decimalVal) {
	// Change charge button appearahce
	$("#charge-button").removeClass("js-charge-button-inactive").addClass("js-charge-button-active");

	// Change clear button appearance
	$("#clear-button").removeClass("js-clear-button-inactive").addClass("js-clear-button-active");

	// Change dollar amount
	$("#js-charge-prompt").text("Charge");
	$("#js-charge-dollar-amount-display").text("$" + myToFixed(decimalVal, 2));
}

// Reset order button states
function resetOrderBarStatus() {
	// Change charge button appearance
	$("#charge-button").removeClass("js-charge-button-active").addClass("js-charge-button-inactive");

	// Change clear button appearance
	$("#clear-button").removeClass("js-clear-button-active").addClass("js-clear-button-inactive");

	// Change dollar amount
	$("#js-charge-prompt").text("Choose an Item");
	$("#js-charge-dollar-amount-display").text("");

	// Change tax amount
	displayTax(0.0);
}

// Remove all items in order list
function removeAllItemsFromOrderList() {
	$(".js-item-cell, .js-customization-cell").remove();
}

// Reset order list
function resetOrderList() {
	removeAllItemsFromOrderList();
	$("#no-item-prompt").fadeIn(200);
}

// Insert into order list
function addItemIntoOrderList(itemName, itemPrice, itemIndex) {
	$("#order-list").append(" \
		<div value=\"drink\" itemIndex=\"" + itemIndex + "\" class=\"js-item-cell shade-bottom\"> \
			<div class=\"js-item-name\">" + itemName + "</div> \
			<div class=\"js-item-price\">$" + myToFixed(itemPrice, 2) + "</div> \
		</div>");
}
function addCustomizationIntoOrderList(itemName, itemPrice, itemIndex, customizationIndex) {
	$("#order-list").append(" \
		<div value=\"customization\" itemIndex=\"" + itemIndex + "\" customizationIndex=\"" + customizationIndex + "\" class=\"js-customization-cell shade-bottom\"> \
			<div class=\"js-item-name vertical-align-text\">" + itemName + "</div> \
			<div class=\"js-item-price vertical-align-text\">$" + myToFixed(itemPrice, 2) + "</div> \
		</div>");
}

// Display custom price
function displayCustomPriceAmount() {
	var priceAmount = parseInt(customNumPadValue);
	priceAmount = priceAmount / 100.0;

	$("#item-prompt-custom-cash-amount").text(myToFixed(priceAmount, 2));
}

// Display actual charge price
function displayChargePrice() {
	displayTax(currentSession.taxPrice);
	displayTotal(currentSession.totalPrice);
}

// Configure payment modal
function configurePaymentModal() {
	// Change title
	$(".modal-payment-amount").text("$" + myToFixed(currentSession.totalPrice, 2));

	// Change tax exempt amount
	$("#payment-tax-exempt-amount").text("$" + myToFixed(currentSession.taxPrice, 2));

	// Change cash amount
	$("#payment-cash-1-amount").text("$" + myToFixed(cashAmountOne(currentSession.totalPrice), 2));
	$("#payment-cash-2-amount").text("$" + myToFixed(cashAmountTwo(currentSession.totalPrice), 2));
}

// Display custom amount of cash
function displayCustomCashAmount() {

	var cashAmount = parseInt(customNumPadValue);
	cashAmount = cashAmount / 100.0;

	var changeAmount = cashAmount - currentSession.totalPrice;
	$("#payment-prompt-custom-cash-amount").text(myToFixed(cashAmount, 2));
	$("#payment-prompt-custom-change-amount").text(myToFixed(changeAmount, 2));
}

// Setup modal bindings
function setupModal() {

	// Close all dialogs when hit background
	$("#modal-overlay-background").on('click', resetModal);

	// Open drink dialog
	$("#short-button, #tall-button, #grande-button, #venti-button").on('click', function () {

		$("#modal-overlay").fadeIn(200);
		$("#modal-drink").fadeIn(200);

		// Change drink modal title
		var size = $(this).find(".item-button-label").text();
		$(".js-modal-drink-size").text(size);

		// Change session selected drink size
		currentSession.currentDrinkSize = size;
	});
	$("#trenta-button").on('click', function () {

		$("#modal-overlay").fadeIn(200);
		$("#modal-drink-trenta").fadeIn(200);

		// Change session selected drink size
		var size = "Trenta"
		currentSession.currentDrinkSize = size;
	});
	$("#espresso-button").on('click', function () {

		$("#modal-overlay").fadeIn(200);
		$("#modal-drink-esp").fadeIn(200);

		// Change session selected drink size
		var size = "Espresso"
		currentSession.currentDrinkSize = size;
	});

	// Open custom price item dialog
	$("#custom-button").on('click', function () {

		customNumPadValue = "0";
		displayCustomPriceAmount();

		$("#modal-overlay").fadeIn(200);
		$("#modal-custom-price").fadeIn(200);
	});
	// Bind the number keys for custom price
	$(".js-custom-price-numpad-button").on('click', function () {
		// Append value to customNumPadValue
		customNumPadValue = customNumPadValue + $(this).text();
		displayCustomPriceAmount();
	});
	// Bind the backspace key for custom price
	$("#custom-price-button-backspace").on('click', function () {
		if (customNumPadValue.length >= 1) {
			customNumPadValue = customNumPadValue.slice(0, -1);
		}
		if (customNumPadValue.length <= 0) {
			customNumPadValue = "0";
		}
		displayCustomPriceAmount();
	});

	// Starbucks button
	$("#starbucks-card-button").on('click', function () {
		$("#starbucks-card-prompt").find(".vertical-align-text").text("Swipe card on the reader");
		$("#starbucks-card-prompt").attr("value", "noswipe");
		$("#starbucks-card-activate-button, #starbucks-card-reload-button, #starbucks-card-deactivate-button").hide();
		$("#modal-overlay").fadeIn(200);
		$("#modal-starbucks-card").fadeIn(200);
	});
	$("#starbucks-card-prompt").on('click', function () {
		// If there's no card, fake a card
		if ($("#starbucks-card-prompt").attr("value") == "noswipe") {
			$("#starbucks-card-prompt").attr("value", "swipe");
			$("#starbucks-card-prompt").find(".vertical-align-text").text("Authorizing...").delay(1500).queue(function() {

				$("#starbucks-card-prompt").find(".vertical-align-text").html("Starbucks Gold Card<br />6000 1234 5678 9900<br />Registered to: Jane Doe<br /><br />Balance: $3.26");
				$("#starbucks-card-activate-button, #starbucks-card-reload-button, #starbucks-card-deactivate-button").fadeIn(200);
				$(this).dequeue();
			});
		}
	});
	$("#starbucks-card-reload-button").on('click', function () {
		$("#modal-starbucks-card-reload").fadeIn(200);
		$("#modal-starbucks-card").fadeOut(200);
	});
	$("#starbucks-card-reload-back-button").on('click', function () {
		$("#modal-starbucks-card").fadeIn(200);
		$("#modal-starbucks-card-reload").fadeOut(200);
	});

	// Open payment dialog
	$("#charge-button").on('click', function () {

		if (currentSession.purchasedItems.length > 0) {
			$("#modal-overlay").fadeIn(200);
			$("#modal-payment-selection").fadeIn(200);
			configurePaymentModal();
		}
	});

	// For cards, open payment wait dialog
	// ND ID needs special treatment: tax exempt
	$("#payment-ndid-gift").on('click', function() {
		$(".modal-payment-amount").text("$" + myToFixed(currentSession.netPrice, 2));
		$("#payment-prompt").find(".payment-button-title").text("Swipe card on the reader...");
		$("#modal-payment-wait-method").text("ND ID / Gift Card");
		$("#payment-wait-back-button").show();
		$("#payment-wait-done-button").hide();
		$("#modal-payment-wait").fadeIn(200);
		$("#modal-payment-selection").fadeOut(200);
	});
	$("#payment-credit-debit, #payment-starbucks-card").on('click', function() {
		$("#payment-prompt").find(".payment-button-title").text("Swipe card on the reader...");
		$("#modal-payment-wait-method").text($(this).text());
		$("#payment-wait-back-button").show();
		$("#payment-wait-done-button").hide();
		$("#modal-payment-wait").fadeIn(200);
		$("#modal-payment-selection").fadeOut(200);
	});
	$("#payment-applepay").on('click', function() {
		$("#payment-prompt").find(".payment-button-title").text("Waiting for NFC payment...");
		$("#modal-payment-wait-method").text($(this).text());
		$("#payment-wait-back-button").show();
		$("#payment-wait-done-button").hide();
		$("#modal-payment-wait").fadeIn(200);
		$("#modal-payment-selection").fadeOut(200);
	});

	// Bind #payment-prompt to fake waiting
	$("#payment-prompt").on('click', function() {
		$("#modal-overlay-blocking").show();
		$("#payment-prompt").find(".payment-button-title").text("Authorizing...").queue(function() {
			$("#payment-wait-back-button").fadeOut(200).delay(1500).queue(function() {
				$("#payment-prompt").find(".payment-button-title").text("Authorization successful.");

				// Copy over last session
				lastSession = $.extend(true, {}, currentSession);
				clearCurrentSession();
				$("#modal-overlay-blocking").fadeOut(200).delay(1500).queue(function() {
					resetModal();
					$(this).dequeue();
				});
				$(this).dequeue();
			});
			$(this).dequeue();
		});
	});

	// For cash, do special setup
	$("#payment-cash-1").on('click', function() {

		var cashAmount = cashAmountOne(currentSession.totalPrice);
		var changeAmount = cashAmount - currentSession.totalPrice;

		$("#payment-prompt").find(".payment-button-title").html("Cash amount: $" + myToFixed(cashAmount, 2) + "<br />Change amount: $" + myToFixed(changeAmount, 2));
		$("#modal-payment-wait-method").text("cash");
		$("#payment-wait-done-button").show();
		$("#modal-payment-wait").fadeIn(200);
		$("#modal-payment-selection").fadeOut(200);
	});
	$("#payment-cash-2").on('click', function() {

		var cashAmount = cashAmountTwo(currentSession.totalPrice);
		var changeAmount = cashAmount - currentSession.totalPrice;

		$("#payment-prompt").find(".payment-button-title").html("Cash amount: $" + myToFixed(cashAmount, 2) + "<br />Change amount: $" + myToFixed(changeAmount, 2));
		$("#modal-payment-wait-method").text("cash");
		$("#payment-wait-done-button").show();
		$("#modal-payment-wait").fadeIn(200);
		$("#modal-payment-selection").fadeOut(200);
	});

	// For custom amount of cash, display the special number pad
	$("#payment-custom-cash").on('click', function() {

		customNumPadValue = "0";

		$("#payment-prompt").find(".payment-button-title").text("");
		displayCustomCashAmount();
		$("#modal-payment-custom-cash").fadeIn(200);
		$("#modal-payment-selection").fadeOut(200);
	});

	// Bind the number keys for custom cash
	$(".js-custom-cash-numpad-button").on('click', function () {
		// Append value to customNumPadValue
		customNumPadValue = customNumPadValue + $(this).text();
		displayCustomCashAmount();
	});

	// Bind the backspace key for custom cash
	$("#custom-cash-button-backspace").on('click', function () {
		if (customNumPadValue.length >= 1) {
			customNumPadValue = customNumPadValue.slice(0, -1);
		}
		if (customNumPadValue.length <= 0) {
			customNumPadValue = "0";
		}
		displayCustomCashAmount();
	});

	// Bind "back" button
	$("#payment-wait-back-button").on('click', function () {
		configurePaymentModal();
		$("#modal-payment-selection").fadeIn(200);
		$("#modal-payment-wait").fadeOut(200);
	});
	$("#payment-custom-back-button").on('click', function () {
		configurePaymentModal();
		$("#modal-payment-selection").fadeIn(200);
		$("#modal-payment-custom-cash").fadeOut(200);
	});

	// Bind "done" button
	$("#payment-wait-done-button").on('click', function () {
		customNumPadValue = "0";
		// Copy over last session
		lastSession = $.extend(true, {}, currentSession);
		clearCurrentSession();
		resetModal();
	});
	$("#payment-custom-done-button").on('click', function () {

		// First calculate the current change amount
		var cashAmount = parseInt(customNumPadValue);
		cashAmount = cashAmount / 100.0;
		var changeAmount = cashAmount - currentSession.totalPrice;

		// Only dismiss if we have enough money paid
		if (changeAmount >= 0) {
			customNumPadValue = "0";

			// Copy over last session
			lastSession = $.extend(true, {}, currentSession);
			clearCurrentSession();
			resetModal();
		}
	});

	// Main function to dispatch on item change
	$(".subitem-button").on('click', function () {

		if ($(this).attr("value") == "drink") {

			// If we're adding a drink, construct the drink with size and name
			var drinkName = $(this).find(".subitem-button-title").text();
			var newDrink = $.extend(true, {}, protoDrink);
			newDrink.itemSize = currentSession.currentDrinkSize;
			newDrink.itemName = drinkName;

			// And add into current session
			currentSession.addItem(newDrink);
			resetModal();

		} else if ($(this).attr("value") == "customization") {

			// If we're adding a customization, construct the customization
			var customizationName = $(this).find(".subitem-button-title").text();
			var newCustomization = $.extend(true, {}, protoCustomization);
			newCustomization.itemName = customizationName;

			// Then add this customziation to the corresponding drink
			currentSession.purchasedItems[currentItemIndex].addCustomization(newCustomization);

			// Don't reset modal
			// resetModal();

		} else if ($(this).attr("value") == "item") {

			resetModal();

		} else if ($(this).attr("value") == "customPrice") {

			// Calculate item price
			var priceAmount = parseInt(customNumPadValue);
			priceAmount = priceAmount / 100.0;

			var newItem = $.extend(true, {}, protoCustomPrice);
			newItem.customItemPrice = priceAmount;
			currentSession.addItem(newItem);

			resetModal();

		} else if ($(this).attr("value") == "cardReload") {

			var newReload = $.extend(true, {}, protoCardReload);
			newReload.reloadAmount = parseInt($(this).attr("reload-amount"));
			currentSession.addItem(newReload);

			resetModal();

		} else if ($(this).attr("value") == "deleteItem") {

			currentSession.removeItem(currentItemIndex);
			resetModal();

		} else if ($(this).attr("value") == "deleteCustomization") {
			currentSession.purchasedItems[currentItemIndex].removeCustomization(currentCustomizationIndex);
			resetModal();
		}
	});

	// Customize drinks
	$(document).on('click', ".js-item-cell", function () {
		currentItemIndex = parseInt( $(this).attr("itemIndex") );

		if ($(this).attr("value") == "drink") {

			// Move #modal-customization-drink to the correct position, and move its background
			var originalPosition = $(this).offset();
			var newLeft = itemCellSize.width;
			var newTop = originalPosition.top >= 448 ? 448 : originalPosition.top;
			$("#modal-customization-drink").css({
				"left" : newLeft,
				"top" : newTop,
				"background" : "url(img/bg-pattern.png) 0 0 repeat, linear-gradient(rgba(247, 251, 255, 0.6), rgba(247, 251, 255, 0.6)), url(img/bg-blurred.png) -" + newLeft + "px -" + newTop + "px no-repeat"
			});

			// Change #modal-customization-drink's title
			$("#modal-customization-drink-name").text(currentSession.purchasedItems[currentItemIndex].getItemDescription());

			// Show drink customization
			$("#modal-overlay").fadeIn(200);
			$("#modal-customization-drink").fadeIn(200);
		}
	});

	// Delete customization
	$(document).on('click', ".js-customization-cell", function() {
		currentItemIndex = parseInt( $(this).attr("itemIndex") );
		currentCustomizationIndex = parseInt( $(this).attr("customizationIndex") );

		// Move #modal-delete-customization to the correct position, and move its background
		var originalPosition = $(this).offset();
		var newLeft = itemCellSize.width;
		var newTop = originalPosition.top >= 864 ? 864 : originalPosition.top;
		$("#modal-delete-customization").css({
			"left" : newLeft,
			"top" : newTop,
			"background" : "url(img/bg-pattern.png) 0 0 repeat, linear-gradient(rgba(247, 251, 255, 0.6), rgba(247, 251, 255, 0.6)), url(img/bg-blurred.png) -" + newLeft + "px -" + newTop + "px no-repeat"
		});

		// Change #modal-delete-customization's title
		$("#modal-delete-customization-name").text(currentSession.purchasedItems[currentItemIndex].itemCustomization[currentCustomizationIndex].getItemDescription());

		// Show drink customization
		$("#modal-overlay").fadeIn(200);
		$("#modal-delete-customization").fadeIn(200);
	});

	resetModal();
}

// Reset modal status
function resetModal() {
	$("#modal-overlay").children().hide();
	$("#modal-overlay").fadeOut(200);
	$("#modal-overlay-background").show();
}

/*
 * =======================
 *  jQuery Document Ready
 * =======================
 */

$(document).ready(function () {

	// Attach fast click
	$(function() {
    	FastClick.attach(document.body);
	});

	// Replace all @2x images
	if (window.devicePixelRatio == 2) {
		$("img.js-2x-img").each(function (index, image) {
			// Append "@2x" into image name
			var imageType = image.src.substr(-4);
			var imageName = image.src.substr(0, image.src.length - 4);
			imageName += "@2x" + imageType;

			// Reassign image source
			image.src = imageName;
		});
	}

	// Setup modal status
	setupModal();

	// Display infobox contents, and schedule infobox refresh
	displayInfobox();
	setInterval(displayInfobox, 10000);

	// Setup new session
	clearCurrentSession();

	// Reset order bar button status
	resetOrderBarStatus();

	// Bind clear button click
	$("#clear-button").on('click', clearCurrentSession);
});
