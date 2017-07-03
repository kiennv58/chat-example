Array.prototype.unique = function() {
   var a = this.concat();
   for(var i=0; i<a.length; ++i) {
       for(var j=i+1; j<a.length; ++j) {
           if(a[i] === a[j])
               a.splice(j--, 1);
       }
   }

   return a;
};

Array.prototype.clean = function(deleteValue) {
  for (var i = 0; i < this.length; i++) {
    if (this[i] == deleteValue) {         
      this.splice(i, 1);
      i--;
    }
  }
  return this;
};

function detextEmail(str){
    var reg = /(?:[a-z0-9!#$%&'*+=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+=?^_`{|}~-]+)*|\"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*\")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/gi;
    var test = str.match(reg);
    if(test && test.length){
        return {status: true, email: JSON.stringify(test)};
    }
    return {status: false};
}

function detextPhone(str){
    var viettel = [
        '096',
        '097',
        '098',
        '0163',
        '0164',
        '0165',
        '0166',
        '0167',
        '0168',
        '0169'
    ];

    var mobiFone = [
        '090',
        '093',
        '0120',
        '0121',
        '0122',
        '0126',
        '0128'
    ]

    var vinaPhone = [
        '091',
        '094',
        '0123',
        '0124',
        '0125',
        '0127',
        '0129'
    ]

    var vietnamMobile = [
        '092',
        '0188'
    ]

    var sFone = [
        '095'
    ]

    var gMobile = [
        '0993',
        '0994',
        '0995',
        '0996',
        '0199'
    ]

    var prefixPhone = [];
    var reg = '';
    prefixPhone = prefixPhone.concat(viettel, mobiFone, vinaPhone, vietnamMobile, sFone, gMobile);
    prefixPhone.forEach(function(element, index){
        reg+= element + '(\\s?\\.?\\,?[0-9]{3,4}\\s?\\.?\\,?[0-9]{3,4})';
        if (index < prefixPhone.length - 1) {
            reg+= '|';
        }
    });
    regular_expression = new RegExp(reg, 'gi');
    var test = str.match(regular_expression);
    if(test && test.length){
        return {status: true, phone: JSON.stringify(test)};
    }
    return {status: false};
}

function uniqueArray(arr){
    var unique = [];
    for(i = 0; i< arr.length; i++){
        if(unique.indexOf(arr[i]) === -1){
            unique.push(arr[i]);
        }
    }
    return unique;
}

function todayMidNight(){
    var d = new Date();
    var e = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
    return e.getTime();
}

function detextAutoOrder(str){
    var patt = new RegExp("@[a-zA-Z0-9]*");
    return patt.test(str);
}

module.exports = {
    detextEmail,
    detextPhone,
    uniqueArray,
    todayMidNight,
    detextAutoOrder
}