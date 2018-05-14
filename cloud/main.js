

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
Parse.Cloud.define('sendPushNotification', function(request, response) {
  var userId = request.params.userId;
  var message = request.params.message;
  
  sendNotification(userId, message,
  function (errorMessage, result) {
    if (errorMessage)
      response.error(result);
    else 
      response.success();
  });
});

function sendNotification(userId, message, callback) {
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

Parse.Cloud.define('deactivateSchedule', function(request, response) {
  var bookingDayId = request.params.bookingDayId;
  var bookingEventId = request.params.bookingEventId;
  var businessName = request.params.businessName;
  
  var BookingDay = Parse.Object.extend("BookingDay");
  var query = new Parse.Query(BookingDay);
  query.equalTo('objectId', bookingDayId);
  query.include('bookingTickets');
  query.first({
    success: function(bookingDay){
      // Successfully retrieved booking day.
      var bookingTickets = bookingDay.get("bookingTickets");
      
      var numberOfReservedBookingsPerDay = bookingDay.get("numberOfReservedBookingsPerDay");
      var numberOfAvailableBookingsPerDay = bookingDay.get("numberOfAvailableBookingsPerDay");
      if(numberOfReservedBookingsPerDay > 0) {
        var BookingEvent = Parse.Object.extend("BookingEvent");
        var eventQuery = new Parse.Query(BookingEvent);
        eventQuery.equalTo('objectId', bookingEventId);
        eventQuery.first({
          success: function(bookingEvent) {
              var bookingReservedBookings  = bookingEvent.get("bookingReservedBookings");
              var bookingAvailableBookings = bookingEvent.get("bookingAvailableBookings");
              var bookingCancelledBookings = bookingEvent.get("bookingCancelledBookings");
              console.log('1- bookingCancelledBookings: ', bookingCancelledBookings);


            for (var i = 0; i < bookingTickets.length; i++) {
              var bookingTicket = bookingTickets[i];
              bookingTicket.set("bookingEventStatus", "bookingEventStatusDeactivated");
              var bookingTicketStatus = bookingTicket.get("bookingTicketStatus");
              if (bookingTicketStatus == "bookedByBusiness" ||bookingTicketStatus == "bookedByClient") {
                cancellBookingTicket(bookingTicket, businessName, 
                  function (errorMessage, result) {
                    if (errorMessage) {
                    //  response.error(result);
                      console.log("Error here");
                    } else {
                      /// update booking day according to cancellation
                      numberOfReservedBookingsPerDay = numberOfReservedBookingsPerDay - 1;
                      numberOfAvailableBookingsPerDay = numberOfAvailableBookingsPerDay + 1;
                      
                      /// update booking event according to cancellation 
                      bookingReservedBookings  = bookingReservedBookings - 1;
                      bookingAvailableBookings = bookingAvailableBookings + 1;
                      bookingCancelledBookings = bookingCancelledBookings + 1;
                      console.log('2- bookingCancelledBookings: ', bookingCancelledBookings);
                    }
                  });
                } else {
                  bookingTicket.save();
                }                
              }
              bookingEvent.set("bookingReservedBookings", bookingReservedBookings);
              bookingEvent.set("bookingAvailableBookings", bookingAvailableBookings);
              bookingEvent.set("bookingCancelledBookings", bookingCancelledBookings);
              console.log('3- bookingCancelledBookings: ', bookingCancelledBookings);

              bookingEvent.save();
            },
            error: function(error) {
           //   response.error('Booking Event Error:', error);
                    console.log("Booking Event Error");
            }
          });
        } else {
          for (var i = 0; i < bookingTickets.length; i++) {
            var bookingTicket = bookingTickets[i];
            bookingTicket.set("bookingEventStatus", "bookingEventStatusDeactivated");
            bookingTicket.save();
          }
        }
        bookingDay.set("numberOfReservedBookingsPerDay", numberOfReservedBookingsPerDay);
        bookingDay.set("numberOfAvailableBookingsPerDay", numberOfAvailableBookingsPerDay);
        bookingDay.set("bookingEventStatus", "bookingEventStatusDeactivated");
        bookingDay.save();
        
        response.success("successfully deactivated BookingDay");
      },
      error: function(error) {
        response.error('Error in deactivation booking day:', error);
      }
    });
});

function cancellBookingTicket(bookingTicket, businessName, callback){
    bookingTicket.set("bookingTicketStatus", "cancelledByBusiness");
    var CancelledBooking = Parse.Object.extend("CancelledBooking");
    var cancelledBooking = new CancelledBooking();
    cancelledBooking.set("cancellationStatus", 'cancelledByBusiness');
    cancelledBooking.set("cancelledBookingTicket", bookingTicket);
    var business = bookingTicket.get("Business");
    cancelledBooking.set("cancelledBookingBusiness", business);
    cancelledBooking.set("cancellationDate", new Date());
    
    var bookingTicketClientStatus = bookingTicket.get("bookingTicketclientStatus");
    var clientId;
    if (bookingTicketClientStatus == "bookingTicketclientRegistered") {
      var client = bookingTicket.get("client");
      clientId = client.id;
      cancelledBooking.set("cancelledBookingClient", client);
      bookingTicket.set("client", null);
    } else if (bookingTicketClientStatus == "bookingTicketclientGuest") {
      var client = bookingTicket.get("guestClient");
      clientId = client.id;
      cancelledBooking.set("cancelledBookingGuestClient", client);
      bookingTicket.set("guestClient", null);
    }
    
    cancelledBooking.save(null, {
      success: function(cancelledBooking) {              
        bookingTicket.set("bookingTicketclientStatus", "bookingTicketclientUndefined");
        bookingTicket.save(null, {
          success: function(bookingTicket) {              
            /// send push notification to the user to let her know of cancellation
            var bookingDate = bookingTicket.get("bookingTicketDate");              
            var bookingStartTime = bookingTicket.get("bookingTicketStartTime");
            var bookingFinishTime = bookingTicket.get("bookingTicketFinishTime");
            
            sendNotification2(clientId, businessName, bookingDate, bookingStartTime, bookingFinishTime,
              function (errorMessage, result) {
                if (errorMessage)
                   callback('error', error.message);
                else 
                   callback(null, 'Success');
              });
            },
            error: function(bookingTicket, error) {
              // error is a Parse.Error with an error code and message.
              callback('error', error.message);
            }
          });
        },
        error: function(cancelledBooking, error) {
          // error is a Parse.Error with an error code and message.
          callback('error', error.message);
        }
      });
}

function sendNotification2(userId, businessName, bookingDate, bookingStartTime, bookingFinishTime, callback) {
  var message = "Reservation Cancelled\n" + businessName + " cancelled your following reservation\n";
  var dateOptions = { weekday: "long", year: "numeric", month: "long", day: "numeric"};  
  message = message + new Intl.DateTimeFormat("en-US", dateOptions).format(bookingDate) + "\n";  
  var timeOptions = { hour: "2-digit", minute: "2-digit"};
  message = message + new Intl.DateTimeFormat("en-US", timeOptions).format(bookingStartTime) + " to " + new Intl.DateTimeFormat("en-US", timeOptions).format(bookingFinishTime);
  
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
        
Parse.Cloud.define('reactivateSchedule', function(request, response) {
  var bookingDayId = request.params.bookingDayId;
  var bookingEventId = request.params.bookingEventId;

  var BookingDay = Parse.Object.extend("BookingDay");
  var query = new Parse.Query(BookingDay);
  query.equalTo('objectId', bookingDayId);
  query.include('bookingTickets');
  query.first({
    success: function(object) {
      // Successfully retrieved the object.
      var bookingDay = object;

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

