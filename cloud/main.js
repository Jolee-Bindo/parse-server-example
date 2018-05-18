/*
Parse.Cloud.define('sendPushNotification', function(request, response) {
        var userId = request.params.userId;
        var message = request.params.message;
        var queryUser = new Parse.Query(Parse.User);
        queryUser.equalTo('objectId', userId);
  
        var query = new Parse.Query(Parse.Installation);
        query.matchesQuery('user', queryUser);

        Parse.Push.send({
          where: query,
          data: {
            alert: message,
            badge: 1,
            sound: 'default'
          }
        }, {
          useMasterKey: true,
          success: function() {
            console.log('##### PUSH OK');
            response.success();
          },
          error: function(error) {
            console.log('##### PUSH ERROR');
            response.error(error.message);
          }
        });
});
*/
Parse.Cloud.define('createBookingEvent', function(request, response) {
  const query = new Parse.Query("Business");
  query.get(request.params.businessId).then(function(business) {
    var BookingEvent = Parse.Object.extend("BookingEvent");
    var bookingEvent = new BookingEvent();
    bookingEvent.set("bookingStartDate", request.params.bookingStartDate);
    bookingEvent.set("bookingFinishDate", request.params.bookingFinishDate);
    bookingEvent.set("bookingOffDays", request.params.bookingOffDays);
    bookingEvent.set("bookingStartHour", request.params.bookingStartHour);
    bookingEvent.set("bookingFinishHour", request.params.bookingFinishHour);
    bookingEvent.set("bookingStartOffHour", request.params.bookingStartOffHour);
    bookingEvent.set("bookingFinishOffHour", request.params.bookingFinishOffHour);
    bookingEvent.set("bookingSessionDuration", request.params.bookingSessionDuration);
    bookingEvent.set("bookingNumberOfServicesPerSession", request.params.bookingNumberOfServicesPerSession);
    bookingEvent.set("bookingCancellationPeriod", request.params.bookingCancellationPeriod);
    bookingEvent.set("bookingCancellationPolicy", request.params.bookingCancellationPolicy);
    bookingEvent.set("bookingEventStatus", request.params.bookingEventStatus);
    bookingEvent.set("business", business);
    return bookingEvent.save();
  }).then(function(bookingEvent) {
    console.log('----------------bookingEvent:', bookingEvent);
    response.success(bookingEvent);
  }, function(error) {
    console.error("Got an error " + error.code + " : " + error.message);
    response.error("Got an error " + error.code + " : " + error.message);
  });
});


Parse.Cloud.define('cancelReservation', function(request, response) {
  var cancellationStatus = request.params.cancellationStatus;
  
  const query = new Parse.Query("BookingTicket");
  query.get(request.params.bookingTicketId)
  .then(function(bookingTicket) {
    var bookingEventStatus = "bookingEventStatusActive";
    cancelBookingTicket(bookingTicket, cancellationStatus, bookingEventStatus);
    response.success('successfully cancel reservation:', bookingTicket.id);

  }, function(error) {
    console.log('Error', error);
  });
});

Parse.Cloud.define('deactivateSchedule', function(request, response) {
  var query = new Parse.Query("BookingDay");
  query.equalTo('objectId', request.params.bookingDayId);
  query.include("bookingTickets");
  query.first({
    success: function(bookingDay) {
      var bookingTickets = bookingDay.get("bookingTickets");
      var cancellationStatus = "cancelledByBusiness";
      var bookingEventStatus = "bookingEventStatusDeactivated";

      for (var i = 0; i < bookingTickets.length; i++) {
        var bookingTicket = bookingTickets[i];
        var bookingTicketStatus = bookingTicket.get("bookingTicketStatus");
        cancelBookingTicket(bookingTicket, cancellationStatus, bookingEventStatus);
      }
      response.success('successfully deactivated BookingDay:', bookingDay.id);
    }, 
    error: function(error) {
      console.log('Error in deactivating schedule');
    }
  });
});       

function cancelBookingTicket(bookingTicket, cancellationStatus, bookingEventStatus) {
  var bookingTicketStatus = bookingTicket.get("bookingTicketStatus");
  if (bookingTicketStatus == "bookedByBusiness" || bookingTicketStatus == "bookedByClient") {    
    var CancelledBooking = Parse.Object.extend("CancelledBooking");
    var cancelledBooking = new CancelledBooking();
    cancelledBooking.set("cancellationStatus", cancellationStatus);
    cancelledBooking.set("cancelledBookingTicket", bookingTicket);
    cancelledBooking.set("cancelledBookingBusiness", bookingTicket.get("Business"));
    cancelledBooking.set("cancellationDate", new Date());
    
    var bookingTicketClientStatus = bookingTicket.get("bookingTicketclientStatus");
    if (bookingTicketClientStatus == "bookingTicketclientRegistered") {
      cancelledBooking.set("cancelledBookingClient", bookingTicket.get("client"));
      bookingTicket.set("client", null);
    } else if (bookingTicketClientStatus == "bookingTicketclientGuest") {
      cancelledBooking.set("cancelledBookingGuestClient", bookingTicket.get("guestClient"));
      bookingTicket.set("guestClient", null);
    }
    
    cancelledBooking.save().then(function(cancelledBooking) {
      bookingTicket.set("bookingTicketStatus", cancellationStatus);
      bookingTicket.set("bookingTicketclientStatus", "bookingTicketclientUndefined");
      bookingTicket.set("bookingEventStatus", bookingEventStatus);
      return bookingTicket.save();
    }).then(function(bookingTicket) {
      return;
    });
  } else {
    bookingTicket.set("bookingEventStatus", bookingEventStatus);
    bookingTicket.save().then(function(bookingTicket) {
      return;
    });
  }
}   
        
Parse.Cloud.define('reactivateSchedule', function(request, response) {
  var bookingDayId = request.params.bookingDayId;
  var bookingEventId = request.params.bookingEventId;

  var BookingDay = Parse.Object.extend("BookingDay");
  var query = new Parse.Query(BookingDay);
  query.equalTo('objectId', bookingDayId);
  query.include('bookingTickets');
  query.first({
    success: function(bookingDay) {
      // Successfully retrieved the object.
      var bookingTickets = bookingDay.get("bookingTickets");
      for (var i = 0; i < bookingTickets.length; i++) {
        var bookingTicket = bookingTickets[i];
        bookingTicket.set("bookingEventStatus", "bookingEventStatusActive");
        bookingTicket.save();
      }

      bookingDay.set("bookingEventStatus", "bookingEventStatusActive");
      bookingDay.save();
      response.success('successfully activated BookingDay:', object.get('objectId'));
    },
    error: function(error) {
      response.error('Error in deactivation booking day:', error);
    }
  });
});


Parse.Cloud.afterSave("CancelledBooking", function(request) {
  var bookingTicket;
  const ticketQuery = new Parse.Query("BookingTicket");
  ticketQuery.get(request.object.get("cancelledBookingTicket").id)
  .then(function(cancelledBookingTicket) {
    bookingTicket = cancelledBookingTicket;
    const dayQuery = new Parse.Query("BookingDay");
    dayQuery.equalTo("bookingTickets", cancelledBookingTicket);
    return dayQuery.first();
  }).then(function(bookingDay) {
    /// update booking day according to cancellation
    bookingDay.increment("numberOfReservedBookingsPerDay", -1);
    bookingDay.increment("numberOfAvailableBookingsPerDay");
    return bookingDay.save();
  }).then(function(bookingDay) {
    const eventQuery = new Parse.Query("BookingEvent");
    eventQuery.equalTo("bookingDays", bookingDay);
    return eventQuery.first();
  }).then(function(bookingEvent){
    /// update booking event according to cancellation
    bookingEvent.increment("bookingReservedBookings", -1);
    bookingEvent.increment("bookingAvailableBookings");
    bookingEvent.increment("bookingCancelledBookings");
    return bookingEvent.save();
  }).then(function(bookingEvent){
    const businessQuery = new Parse.Query("Business");
    return businessQuery.get(request.object.get("cancelledBookingBusiness").id);
  }).then(function(cancelledBookingBusiness) {
    /// send cancellation notification to user
    var bookingDate = bookingTicket.get("bookingTicketDate");
    var bookingStartTime = bookingTicket.get("bookingTicketStartTime");
    var bookingFinishTime = bookingTicket.get("bookingTicketFinishTime");
    
    var clientId;
    if (request.object.get("cancelledBookingClient") != null) {
      clientId = request.object.get("cancelledBookingClient").id;
    } else if (request.object.get("cancelledBookingGuestClient") != null) {
      clientId = request.object.get("cancelledBookingGuestClient").id;
    }
    var businessName = cancelledBookingBusiness.get("businessName");
    sendPushNotification(clientId, businessName, bookingDate, bookingStartTime, bookingFinishTime,
      function (errorMessage, result) {
        if (errorMessage)
        callback('error', errorMessage);
      });
    }, function(error) {
      console.error("Got an error " + error.code + " : " + error.message);
    });
  });

function sendPushNotification(userId, businessName, bookingDate, bookingStartTime, bookingFinishTime, callback) {
  var message = "Reservation Cancelled\n" + businessName + " cancelled your following reservation\n";
  var dateOptions = { weekday: "long", year: "numeric", month: "long", day: "numeric"};  
  message = message + new Intl.DateTimeFormat("en-US", dateOptions).format(bookingDate) + "\n";  
  var timeOptions = { hour: "2-digit", minute: "2-digit"};
 // message = message + new Intl.DateTimeFormat("en-US", timeOptions).format(bookingStartTime) + " to " + new Intl.DateTimeFormat("en-US", timeOptions).format(bookingFinishTime);
  message = message + bookingStartTime.toLocaleTimeString('en-US', timeOptions) + " to " + bookingFinishTime.toLocaleTimeString('en-US', timeOptions);
  console.log(message);
  var queryUser = new Parse.Query(Parse.User);
  queryUser.equalTo('objectId', userId);
  var query = new Parse.Query(Parse.Installation);
  query.matchesQuery('user', queryUser);

  Parse.Push.send({
    where: query,
    data: {
      alert: message,
      badge: 1,
      sound: 'default'
    }
  }, {
    useMasterKey: true,
    success: function() {
      console.log('##### PUSH OK');
      callback(null, 'Success');
    },
    error: function(error) {
      console.log('##### PUSH ERROR');
      callback('error', error.message);
    }
  });
}

Parse.Cloud.afterSave("BookingEvent", function(request) {
  // Get the schedule start and finish dates at midnight.  
  var scheduleStartDate = request.object.get("bookingStartDate");
  var scheduleStartDateAtMidn = new Date(scheduleStartDate.getFullYear(), scheduleStartDate.getMonth(), scheduleStartDate.getDate());  
  console.log('start date: ', scheduleStartDateAtMidn);
  
  var scheduleFinishDate = request.object.get("bookingFinishDate");
  var scheduleFinishDateAtMidn = new Date(scheduleFinishDate.getFullYear(), scheduleFinishDate.getMonth(), scheduleFinishDate.getDate());  
  console.log('finish date: ', scheduleFinishDateAtMidn);
  
  var bookingDate = scheduleStartDateAtMidn;
  while (bookingDate.getTime() <= scheduleFinishDateAtMidn.getTime()) {    
    var options = {weekday: "long"};  
    var weekDay = bookingDate.toLocaleTimeString("en-us", options);
    console.log('Week Day: ', weekDay);
    
    var offDaysArray = request.object.get("bookingOffDays").split(",");
    console.log('Off days array length: ', offDaysArray.length);
    
    if (offDaysArray.includes(weekDay) == false) {
      console.log('not includes');
      var bookingStartHour = request.object.get("bookingStartHour");
      var bookingFinishHour = request.object.get("bookingFinishHour");
      var bookingStartOffHour = request.object.get("bookingStartOffHour");
      var bookingFinishOffHour = request.object.get("bookingFinishOffHour");
      var bookingSessionDuration = request.object.get("bookingSessionDuration");
      
      var request = {bookingDate:bookingDate, bookingStartHour:bookingStartHour, bookingFinishHour:bookingFinishHour, bookingStartOffHour:bookingStartOffHour, bookingFinishOffHour:bookingFinishOffHour, bookingSessionDuration:bookingSessionDuration};
      createBookingDay(request);        
    }
    bookingDate.setDate(bookingDate.getDate() + 1);
  }
  
  return;    
});

function createBookingDay(request) {
  var BookingDay = Parse.Object.extend("BookingDay");
  var bookingDay = new BookingDay();
  bookingDay.set("bookingDate", );
  bookingDay.set("bookingStartHour", );
  bookingDay.set("bookingFinishHour", );
  bookingDay.set("bookingStartOffHour", );
  bookingDay.set("bookingFinishOffHour", );
  bookingDay.set("bookingSessionDuration", );
  bookingDay.save().then(function(bookingDay) {
    console.log('----------------bookingDay:', bookingDay);
      return;
    });
}

