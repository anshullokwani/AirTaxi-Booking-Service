const axios = require('axios');
const AppError = require('../utils/errors/app-error');
const { BookingRepository } = require('../repositories');
const { ServerConfig } = require('../config')
const db = require('../models');
const { StatusCodes } = require('http-status-codes');
const bookingRepository = new BookingRepository();
const { Enums } = require('../utils/common');
const { BOOKED, CANCELLED, INITIATED, PENDING } = Enums.BOOKING_STATUS;

async function createBooking(data) {
    const transaction = await db.sequelize.transaction();
    try {
        const flight = await axios.get(`${ServerConfig.FLIGHT_SERVICE}/api/v1/flight/${data.flightId}`);
        const flightData = flight.data.data;
        if(data.noOfSeats > flightData.totalSeats) {
            throw new AppError('Not enough seats available', StatusCodes.BAD_REQUEST);
        }
        const totalBillingAmount = data.noOfSeats * flightData.price;
        const bookingPayload = {...data, totalCost: totalBillingAmount};
        const booking = await bookingRepository.create(bookingPayload, transaction);

        const response = await axios.patch(`${ServerConfig.FLIGHT_SERVICE}/api/v1/flight/${data.flightId}/seats`, {
            seats: data.noOfSeats
        });

        await transaction.commit();
        return booking;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}
async function makePayment(data) {
    const transaction = db.sequelize.transaction();
    try {
        const bookingDetails = await bookingRepository.get(data.bookingId, transaction);
        if(bookingDetails.status == CANCELLED) {
            throw new AppError('The booking has expired', StatusCodes.BAD_REQUEST);
        }
        const bookingTime = new Date(bookingDetails.createdAt);
        const currentTime = new Date();
        if(currentTime - bookingTime > 300000) {
            await bookingRepository.cancelBooking(data.bookingId);
            throw new AppError('The booking has expired!', StatusCodes.BAD_REQUEST);
        }
        if(bookingDetails.totalCost != data.totalCost) {
            throw new AppError('The payment is failed!', StatusCodes.BAD_REQUEST);
        }
        if(bookingDetails.userId != data.userId) {
            throw new AppError('User does not match!', StatusCodes.BAD_REQUEST);
        }
        const response = await bookingRepository.update(data.bookingId, {status: BOOKED}, transaction);
        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

async function cancelBooking(bookingId) {
    const transaction = await db.sequelize.transaction();
    try{
        const bookingDetails = await bookingRepository.get(bookingId, transaction);
        if(bookingDetails.status == CANCELLED) {
            await transaction.commit();
            return true;
        }
        await axios.patch(`${ServerConfig.FLIGHT_SERVICE}/api/v1/flight/${bookingDetails.flightId}/seats`, {
            seats: bookingDetails.noOfSeats,
            decrease: 0
        });
        await bookingRepository.update(bookingId, {status: CANCELLED}, transaction);
        await transaction.commit();
    } catch(error) {
        await transaction.rollback();
        throw error;
    }
}

module.exports = {
    createBooking,
    makePayment
}