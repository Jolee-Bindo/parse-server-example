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
    console.log('Schedule Successfully created with id:', bookingEvent.objectId);
    response.success(bookingEvent);
  }, function(error) {
    console.error("Error in creating Schedule " + error.code + " : " + error.message);
    response.error("Error in creating Schedule " + error.code + " : " + error.message);
  });
});

Parse.Cloud.afterSave("BookingEvent", function(request) {
  var bookingEventId = request.object.id;
  var bookingStartHour = request.object.get("bookingStartHour");
  var bookingFinishHour = request.object.get("bookingFinishHour");
  var bookingStartOffHour = request.object.get("bookingStartOffHour");
  var bookingFinishOffHour = request.object.get("bookingFinishOffHour");
  var bookingSessionDuration = request.object.get("bookingSessionDuration");
  
  // Get the schedule start and finish dates at midnight.  
  var scheduleStartDate = request.object.get("bookingStartDate");
  var scheduleStartDateAtMidn = new Date(scheduleStartDate.getFullYear(), scheduleStartDate.getMonth(), scheduleStartDate.getDate());  
  console.log('start date: ', scheduleStartDateAtMidn);
  
  var scheduleFinishDate = request.object.get("bookingFinishDate");
  var scheduleFinishDateAtMidn = new Date(scheduleFinishDate.getFullYear(), scheduleFinishDate.getMonth(), scheduleFinishDate.getDate());  
  console.log('finish date: ', scheduleFinishDateAtMidn);
  
  var bookingDate = scheduleStartDateAtMidn;
  var offDaysArray = request.object.get("bookingOffDays").split(",");
  
  while (bookingDate.getTime() <= scheduleFinishDateAtMidn.getTime()) {    
    var options = {weekday: "long"};  
    var weekDay = bookingDate.toLocaleDateString("en-us", options);
    
    if (offDaysArray.includes(weekDay) == false) {
      var bookingDayDate = new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate());      
      var request = {bookingEventId:bookingEventId, bookingDate:bookingDayDate, bookingStartHour:bookingStartHour, bookingFinishHour:bookingFinishHour, bookingStartOffHour:bookingStartOffHour, bookingFinishOffHour:bookingFinishOffHour, bookingSessionDuration:bookingSessionDuration};
      createBookingDay(request, function (errorMessage, result) {
        if (errorMessage) {
          console.error("Error in Schedule afterSave " + error.code + " : " + error.message);
        } else {
          console.log('Schedule afterSave Successful');
        }
      });
    }
    bookingDate.setDate(bookingDate.getDate() + 1);
  }
});

function createBookingDay(request, response) {
  const query = new Parse.Query("BookingEvent");
  query.get(request.bookingEventId).then(function(bookingEvent) {
    var BookingDay = Parse.Object.extend("BookingDay");
    var bookingDay = new BookingDay();
    bookingDay.set("bookingDate", request.bookingDate);
    bookingDay.set("bookingStartHour", request.bookingStartHour);
    bookingDay.set("bookingFinishHour", request.bookingFinishHour);
    bookingDay.set("bookingStartOffHour", request.bookingStartOffHour);
    bookingDay.set("bookingFinishOffHour", request.bookingFinishOffHour);
    bookingDay.set("bookingSessionDuration", request.bookingSessionDuration);
    bookingDay.set("bookingEvent", bookingEvent);
    return bookingDay.save();
  }).then(function(bookingDay) {
    response(null, 'Success');
  }, function(error) {
    response(error, 'Error');
  });
}

Parse.Cloud.afterSave("BookingDay", function(request) {
  var bookingDaytId = request.object.id;
  var bookingTicketDate = request.object.get("bookingDate");
  var startSessionTime = request.object.get("bookingStartHour");
  var finishWorkingHour = request.object.get("bookingFinishHour");
  var startOffHour = request.object.get("bookingStartOffHour");
  var finishOffHour = request.object.get("bookingFinishOffHour");
  var sessionDuration = request.object.get("bookingSessionDuration");
  
  const query = new Parse.Query("BookingEvent");
  query.get(request.object.get("bookingEvent").id).then(function(bookingEvent) {
    var businessId = bookingEvent.get("business").id;
    var bookingCancellationPeriod = bookingEvent.get("bookingCancellationPeriod");
    var numberOfServicesPerSession = bookingEvent.get("bookingNumberOfServicesPerSession");
    var cancellationDeadlineDate = new Date(bookingTicketDate);
    cancellationDeadlineDate.setDate(cancellationDeadlineDate.getDate() - bookingCancellationPeriod);
    var nextSessionTime = new Date(startSessionTime);
    var sessionTime = new Date(startSessionTime);
    
    while (sessionTime.getTime() <= finishWorkingHour.getTime()) {
      nextSessionTime.setSeconds(nextSessionTime.getSeconds() + sessionDuration);
      if (sessionTime.getTime() < startOffHour || sessionTime.getTime() >= finishOffHour) {
        var request = {bookingDayId:bookingDaytId, businessId:businessId, bookingTicketDate:bookingTicketDate, bookingTicketStartTime:sessionTime, bookingTicketFinishTime:nextSessionTime, bookingTicketCancellationDeadlineDate:cancellationDeadlineDate};
        for (var index = 0; index < numberOfServicesPerSession; index++) {
          createBookingTicket(request, function (errorMessage, result) {
            if (errorMessage) {
              console.error('Error in creating booking ticket;', errorMessage);
            } else {
              console.log('Create BookingTicket Successful');
            }
          });
        }
      } 
      
      sessionTime = new Date(nextSessionTime);
    }
  },
  function(error) {
    console.error("Error in BookingDay afterSave " + error.code + " : " + error.message);
  });
});
      
function createBookingTicket(request, response) {
  const query = new Parse.Query("BookingDay");
  return query.get(request.bookingDayId).then(function(bookingDay) {
    const query = new Parse.Query("Business");
    return query.get(request.businessId);
  }).then(function(business) {
    var BookingTicket = Parse.Object.extend("BookingTicket");
    var bookingTicket = new BookingTicket();
    bookingTicket.set("business", business);
    bookingTicket.set("bookingTicketDate", request.bookingTicketDate);
    bookingTicket.set("bookingTicketStartTime", request.bookingTicketStartTime);
    bookingTicket.set("bookingTicketFinishTime", request.bookingTicketFinishTime);
    bookingTicket.set("bookingTicketBusinessRateStatus", "bookingTicketBusinessRateStatusNotRated");
    bookingTicket.set("bookingTicketStatus", "bookingTicketStatusAvailable");
    bookingTicket.set("bookingTicketClientStatus", "bookingTicketClientStatusUndefined");
    bookingTicket.set("bookingTicketCancellationDeadlineDate", request.bookingTicketCancellationDeadlineDate);
    bookingTicket.set("bookingTicketClientStatus", "bookingTicketClientStatusUndefined");
    return bookingTicket.save();
  }).then(function(bookingTicket) {
    response(null, 'Success');
  }, function(error) {
    response(error, 'Error');
  });
}

Parse.Cloud.define('cancelReservation', function(request, response) {
  var cancellationStatus = request.params.cancellationStatus;
  const query = new Parse.Query("BookingTicket");
  query.get(request.params.bookingTicketId)
  .then(function(bookingTicket) {
    var bookingEventStatus = "bookingEventStatusActive";
    var request = {bookingTicket:bookingTicket, cancellationStatus:cancellationStatus, bookingEventStatus:bookingEventStatus};
    cancelBookingTicket(request, function (error, result) {
      if (error) {
        console.error("Error in Cancelling Reservation " + error.code + " : " + error.message);
      } else {
        console.log('Reservation Successfully Cancelled with id:', bookingTicket.id);
        response.success('Reservation Successfully Cancelled with id:', bookingTicket.id);
      }
    });
    
  }, function(error) {
    console.error("Error in Cancelling Reservation " + error.code + " : " + error.message);
  });
});

function cancelBookingTicket(request, response) {
  var bookingTicket = request.bookingTicket;
  var bookingEventStatus = request.bookingEventStatus;
  var cancellationStatus = request.cancellationStatus;
  
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
      response(null, 'Success');
      
    } ,function(error) {
      response(error, 'Failed');
    });
  } else {
    bookingTicket.set("bookingEventStatus", bookingEventStatus);
    bookingTicket.save().then(function(bookingTicket) {
      response(null, 'Success');
    }, function(error) {
      response(error, 'Failed');
    });
  }
}

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
    var request = {clientId:clientId, businessName:businessName, bookingDate:bookingDate, bookingStartTime:bookingStartTime, bookingFinishTime:bookingFinishTime};
    
    sendPushNotification(request, function (error, result) {
      if (error) {
        console.error("Error in Pushing Cancel Reservation Notification " + error.code + " : " + error.message);
      } else {
        console.log('Cancel Reservation Push Notification Successfully Sent');
      }
    });
  }, function(error) {
    console.error("Got an error " + error.code + " : " + error.message);
  });
});

Parse.Cloud.define('deactivateSchedule', function(request, response) {
  const query = new Parse.Query("BookingEvent");
  query.get(request.object.get(request.params.bookingEventId))
  .then(function(bookingEvent) {
    var BookingDay = Parse.Object.extend("BookingDay");
    var query = new Parse.Query(BookingDay);
    query.equalTo('bookingEvent', bookingEvent);
    query.include('bookingTickets');
    return query.find();
  }).then(function(bookingDays){
    for (var bookingDay in bookingDays) {
      var bookingTickets = bookingDay.get("bookingTickets");
      var cancellationStatus = "cancelledByBusiness";
      var bookingEventStatus = "bookingEventStatusDeactivated";
      for (var index = 0; index < bookingTickets.length; index++) {
        var bookingTicket = bookingTickets[index];
        //        var bookingTicketStatus = bookingTicket.get("bookingTicketStatus");
        var request = {bookingTicket:bookingTicket, cancellationStatus:cancellationStatus, bookingEventStatus:bookingEventStatus};
        cancelBookingTicket(request, function (error, result) {
          if (error) {
            console.error("Error in Cancelling Reservation " + error.code + " : " + error.message);
          } else {
            console.log('Reservation Successfully Cancelled with id:', bookingTicket.id);
          }
        });
      }
    }
    console.log("Schedule Successfully Deactivated");
    response.success(bookingEvent);
  } ,function(error) {
    console.error("Error in Deactivating Schedule " + error.code + " : " + error.message);
    response.error("Error in Deactivating Schedule " + error.code + " : " + error.message);
  });
}); 
        
Parse.Cloud.define('reactivateSchedule', function(request, response) {
  const query = new Parse.Query("BookingEvent");
  query.get(request.object.get(request.params.bookingEventId))
  .then(function(bookingEvent) {
    var BookingDay = Parse.Object.extend("BookingDay");
    var query = new Parse.Query(BookingDay);
    query.equalTo('bookingEvent', bookingEvent);
    query.include('bookingTickets');
    return query.find();
  }).then(function(bookingDays){
    for (var bookingDay in bookingDays) {
      var bookingTickets = bookingDay.get("bookingTickets");
      for (var index = 0; index < bookingTickets.length; index++) {
        var bookingTicket = bookingTickets[index];
        bookingTicket.set("bookingEventStatus", "bookingEventStatusActive");
        bookingTicket.save();
      }
      
      bookingDay.set("bookingEventStatus", "bookingEventStatusActive");
      bookingDay.save();      
    }
    console.log("Schedule Successfully Reactivated");
    response.success(bookingEvent);
    
  }, function(error) {
    console.error("Error in Reactivating Schedule " + error.code + " : " + error.message);
    response.error("Error in Reactivating Schedule" + error.code + " : " + error.message);
  });
});

function sendPushNotification(request, response) {
  var userId = request.userId;
  var businessName = request.businessName;
  var bookingDate = request.bookingDate;
  var bookingStartTime = request.bookingStartTime;
  var bookingFinishTime = request.bookingFinishTime;
  
  var message = "Reservation Cancelled\n" + businessName + " cancelled your following reservation\n";
  var dateOptions = { weekday: "long", year: "numeric", month: "long", day: "numeric"};  
  message = message + new Intl.DateTimeFormat("en-US", dateOptions).format(bookingDate) + "\n";  
  var timeOptions = { hour: "2-digit", minute: "2-digit"};
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
      response(null, 'Success');
    },
    error: function(error) {
      console.log('##### PUSH ERROR');
      response(error, 'Failed');
    }
  });
}


