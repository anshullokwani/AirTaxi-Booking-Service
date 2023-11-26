const axios = require('axios');
const AppError = require('../utils/errors/app-error');
const { BookingRepository } = require('../repositories');
const { ServerConfig } = require('../config')
const db = require('../models');
const { StatusCodes } = require('http-status-codes');

async function createBooking(data) {
    return new Promise((resolve, reject) => {
        const result = db.sequelize.transaction(async function bookingImpl(transaction) {
            const flight = await axios.get(`${ServerConfig.FLIGHT_SERVICE}/api/v1/flight/${data.flightId}`);
            const flightData = flight.data.data;
            if(data.noOfSeats > flightData.totalSeats) {
                reject(new AppError('Not enough seats available', StatusCodes.BAD_REQUEST));
            }
            resolve(true);
        });
    })
}


module.exports = {
    createBooking
}