
Parse.Cloud.define('hello', function(req, res) {
  res.success('Hi');
});

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

Parse.Cloud.define('deactivateEvent', function(request, response) {
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
      var bookingDayID = bookingDay.get("objectId");

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
          } else if (bookingTicketClientStatus == "bookingTicketclientGuest") {
            var client = bookingTicket.get("guestClient");
            cancelledBooking.set("cancelledBookingGuestClient", client);
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
                //  alert("Booking Event Error: " + error.code + " " + error.message);
                  console.log('booking event not found');
                //  response.error("Booking Event Error");

                }
              });
              
            },
            error: function(cancelledBooking, error) {
              // Execute any logic that should take place if the save fails.
              // error is a Parse.Error with an error code and message.
              console.log('cancelled booking error');

              alert('Failed to create new object, with error code: ' + error.message);
            }
          });
        }
      //  alert(object.id + ' - ' + cancelledBooking.get('objectId'));
      bookingTicket.set("bookingEventStatus", 'bookingEventStatusNotActive');
      bookingTicket.save();

      }
      bookingDay.set("bookingEventStatus", "bookingEventStatusNotActive");
      bookingDay.save();

      response.success('successfully deactivated BookingDay:', object.get('objectId'));

    },
    error: function(error) {
      alert("Error: " + error.code + " " + error.message);
      response.error("Error here...");
    }
  });
});
