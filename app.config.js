export default ({ config }) => {
  return {
    ...config,
    extra: {
      BASE_URL: process.env.BASE_URL || "http://192.168.0.169:5000",
      ROUTER_IP: process.env.ROUTER_IP || "192.168.0.169",
      PORT_BOOKINGS: process.env.PORT_BOOKINGS || "5000",
    },
  };
};