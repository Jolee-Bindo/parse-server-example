
Parse.Cloud.define('hello', function(req, res) {
  res.success('Hi');
});
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
  
  var result = sendNotification(userId, message);
  if (result == 'Success') {
    response.success();
  } else {
    response.error(result);
  }
});

function sendNotification(userId, message) {
  var queryUser = new Parse.Query(Parse.User);
  queryUser.equalTo('objectId', userId);
  console.log('here');
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
      return('Success');
//      response.success();
    },
    error: function(error) {
      console.log('##### PUSH ERROR');
      return(error.message);
//      response.error(error.message);
    }
  });
}

Parse.Cloud.define('deactivateSchedule', function(request, response) {
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
        var bookingTicketStatus = bookingTicket.get("bookingTicketStatus");
        if (bookingTicketStatus == "bookedByBusiness" || bookingTicketStatus == "bookedByClient") {
          bookingTicket.set("bookingTicketStatus", "cancelledByBusiness");
          var CancelledBooking = Parse.Object.extend("CancelledBooking");
          var cancelledBooking = new CancelledBooking();
          
          cancelledBooking.set("cancellationStatus", 'bookingTicketStatusCancelledByBusiness');
          cancelledBooking.set("cancelledBookingTicket", bookingTicket);
          var business = bookingTicket.get("Business");
          cancelledBooking.set("cancelledBookingBusiness", business);
          var now = new Date();
          cancelledBooking.set("cancellationDate", now);
          
          var bookingTicketClientStatus = bookingTicket.get("bookingTicketclientStatus");
          if (bookingTicketClientStatus == "bookingTicketclientRegistered") {
            var client = bookingTicket.get("client");
            cancelledBooking.set("cancelledBookingClient", client);
            bookingTicket.set("client", null);

          } else if (bookingTicketClientStatus == "bookingTicketclientGuest") {
            var client = bookingTicket.get("guestClient");
            cancelledBooking.set("cancelledBookingGuestClient", client);
            bookingTicket.set("guestClient", null);
          }
          
          cancelledBooking.save(null, {
            success: function(cancelledBooking) {
              var numberOfReservedBookingsPerDay = bookingDay.get("numberOfReservedBookingsPerDay");
              bookingDay.set("numberOfReservedBookingsPerDay", numberOfReservedBookingsPerDay - 1);
              var numberOfAvailableBookingsPerDay = bookingDay.get("numberOfAvailableBookingsPerDay");
              bookingDay.set("numberOfAvailableBookingsPerDay", numberOfAvailableBookingsPerDay + 1);
             
              var BookingEvent = Parse.Object.extend("BookingEvent");
              var eventQuery = new Parse.Query(BookingEvent);
              eventQuery.equalTo('objectId', bookingEventId);
              eventQuery.first({
                success: function(object) {
                  // Successfully retrieved the object.
                  var bookingEvent = object;
                  var bookingReservedBookings  = bookingEvent.get("bookingReservedBookings") - 1;
                  bookingEvent.set("bookingReservedBookings", bookingReservedBookings);
                  var bookingAvailableBookings = bookingEvent.get("bookingAvailableBookings") + 1;
                  bookingEvent.set("bookingAvailableBookings", bookingAvailableBookings);
                  var bookingCancelledBookings = bookingEvent.get("bookingCancelledBookings") + 1;
                  bookingEvent.set("bookingCancelledBookings", bookingCancelledBookings);
                  bookingEvent.save();
                },
                error: function(error) {
                 response.error('Booking Event Error:', error);
                }
              });
              
            },
            error: function(cancelledBooking, error) {
              // error is a Parse.Error with an error code and message.
              response.error('Booking Event Error:', error);
            }
          });
        }
      bookingTicket.set("bookingEventStatus", "bookingEventStatusDeactivated");
      bookingTicket.set("bookingTicketclientStatus", "bookingTicketclientUndefined");
      bookingTicket.save();
      }
      
      bookingDay.set("bookingEventStatus", "bookingEventStatusDeactivated");
      bookingDay.save();

      response.success('successfully deactivated BookingDay:', object.get('objectId'));
    },
    error: function(error) {
      response.error('Error in deactivation booking day:', error);
    }
  });
});


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

