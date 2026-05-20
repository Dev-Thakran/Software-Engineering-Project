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

const checkinstate2 = document.getElementById('checkin-input2');
const checkoutstate2 = document.getElementById('checkout-input2');
const checkdatesum2 = document.getElementById('checkdate-sum2');
const gueststate2 = document.getElementById('guest-input2');

//checkout date limited by checkin
checkindate.addEventListener('change', function() {
    const checkinInput = checkindate.value;
    checkoutdate.min = checkinInput;

    checkinstate.innerHTML = checkindate.value || "-";
    checkinstate2.innerHTML = checkindate.value || "-";
    calculateNights();
});

checkoutdate.addEventListener('change', function() {
    checkoutstate.innerHTML = checkoutdate.value || "-";
    checkoutstate2.innerHTML = checkoutdate.value || "-";
    calculateNights();
});

guestInput.addEventListener('change', function() {
    gueststate.innerHTML = guestInput.value || "-";
    gueststate2.innerHTML = guestInput.value || "-";
});


function calculateNights() {
    const checkin = new Date(checkindate.value);
    const checkout = new Date(checkoutdate.value);
    const nightsDis = document.getElementById('nightsdisplay')
    const nightsDis2 = document.getElementById('nightsdisplay2')


    if (checkindate.value && checkoutdate.value) {
        const timediff = checkout - checkin;
        const daydiff = timediff / (1000*60*60*24);

        checkdatesum.innerHTML = daydiff + " night(s)";
        checkdatesum2.innerHTML = daydiff + " night(s)";
        nightsDis.innerHTML = daydiff
        nightsDis2.innerHTML = daydiff
    } else {
        checkdatesum.innerHTML = "-";
        checkdatesum2.innerHTML = "-";
        nightsDis.innerHTML = "-";
        nightsDis2.innerHTML = "-";
    }
}


//switching slides
const infobtn = document.getElementById('infobtn');
const paybtn = document.getElementById('paybtn');
const contpay = document.getElementById('continuepaybtn');

const infoslid = document.getElementById('info-slide');
const payslid = document.getElementById('pay-slide');

const infoline = document.getElementById('infolne');
const payline = document.getElementById('paylne');

infobtn.addEventListener('click', () => {
    infoslid.classList.remove('hidden');
    infoline.classList.replace('border-t-6', 'border-t-2');

    payslid.classList.add('hidden');
    payline.classList.replace('border-t-2', 'border-t-6');
}); 

contpay.addEventListener('click', () => {
    infoslid.classList.add('hidden');
    infoline.classList.replace('border-t-2', 'border-t-6');

    payslid.classList.remove('hidden');
    payline.classList.replace('border-t-6', 'border-t-2');
})

paybtn.addEventListener('click', () => {
    infoslid.classList.add('hidden');
    infoline.classList.replace('border-t-2', 'border-t-6');

    payslid.classList.remove('hidden');
    payline.classList.replace('border-t-6', 'border-t-2');
})



//display card info on mock card
const cardName = document.getElementById('cardname');
const cardNo = document.getElementById('cardno');
const cardExp = document.getElementById('cardexp');

const cardnoDis = document.getElementById('cardno-dis');
const cardnameDis = document.getElementById('cardname-dis');
const cardexpDis = document.getElementById('cardexp-dis');

cardName.addEventListener('change', function() {
    cardnameDis.innerHTML = cardName.value || "Name on Card";
});

cardNo.addEventListener('change', function() {
    cardnoDis.innerHTML = cardNo.value || "4242 4242 4242 4242";
})

cardExp.addEventListener('change', function() {
    cardexpDis.innerHTML = cardExp.value || "MM/YY"
})