//checkin date limited today >
const today = new Date().toISOString().split('T')[0];
document.getElementById('checkin').setAttribute('min', today);

const checkindate = document.getElementById('checkin');
const checkoutdate = document.getElementById('checkout');
const guestInput = document.getElementById('guestinput');

const checkinstate = document.getElementById('checkin-input');
const checkoutstate = document.getElementById('checkout-input');
const checkdatesum = document.getElementById('checkdate-sum');
const gueststate = document.getElementById('guest-input');

//checkout date limited by checkin
checkindate.addEventListener('change', function() {
    const checkinInput = checkindate.value;
    checkoutdate.min = checkinInput;

    checkinstate.innerHTML = checkindate.value || "-";
    calculateNights();
});

checkoutdate.addEventListener('change', function() {
    checkoutstate.innerHTML = checkoutdate.value || "-";
    calculateNights();
});

guestInput.addEventListener('change', function() {
    gueststate.innerHTML = guestInput.value || "-";
});


function calculateNights() {
    const checkin = new Date(checkindate.value);
    const checkout = new Date(checkoutdate.value);
    const nightsDis = document.getElementById('nightsdisplay')

    if (checkindate.value && checkoutdate.value) {
        const timediff = checkout - checkin;
        const daydiff = timediff / (1000*60*60*24);

        checkdatesum.innerHTML = daydiff + " night(s)";
        nightsDis.innerHTML = daydiff
    } else {
        checkdatesum.innerHTML = "-";
        nightsDis.innerHTML = "-";
    }
}