import React from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import PropTypes from 'prop-types';
import { Global } from '../utils/Global';

export const Card = ({ employeeData, apiurl, fileurl = 'file/filedownload/photo/' }) => {
  if (!employeeData || typeof employeeData !== 'object') {
    return null;
  }

  const { facename, faceid, imageurl } = employeeData;

  const employeeName = facename || 'Unknown Employee';
  const employeeId = faceid || 'N/A';

  const imageSource = imageurl
    ? { uri: `${apiurl}${fileurl}${imageurl}` }
    : null;

  return (
    <View style={styles.card}>
      {/* Employee Image or Fallback Icon */}
      <View style={styles.imageWrapper}>
        {imageurl ? (
          <Image
            source={imageSource}
            style={styles.image}
            resizeMode="cover"
            onError={() => {
              try {
                throw new Error(`Error loading image for employee: ${employeeName}`);
              } catch (err) {
                console.error(err);
              }
            }}
          />
        ) : (
          <View style={styles.iconContainer}>
            <Icon name="person-outline" size={60} color={Global.AppTheme.primary} />
          </View>
        )}
        <View style={styles.imageOverlay} />
      </View>

      {/* Employee Info */}
      <Text style={styles.name}>{employeeName}</Text>
      <Text style={styles.id}>ID: {employeeId}</Text>

      {/* Verified Badge */}
      <View style={styles.badgeWrapper}>
        <View style={styles.badge}>
          <Icon name="verified-user" size={16} color={Global.AppTheme.success} />
          <Text style={styles.badgeText}>Identity Verified</Text>
        </View>
      </View>
    </View>
  );
};

Card.propTypes = {
  employeeData: PropTypes.shape({
    facename: PropTypes.string,
    faceid: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    imageurl: PropTypes.string,
  }),
  apiurl: PropTypes.string,
  fileurl: PropTypes.string,
};

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    marginVertical: 20,
    width: '100%',
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  imageWrapper: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: Global.AppTheme.primary,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
  },
  name: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 15,
    color: Global.AppTheme.light,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif-medium',
  },
  id: {
    fontSize: 15,
    color: Global.AppTheme.gray,
    marginTop: 5,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  },
  badgeWrapper: {
    flexDirection: 'row',
    marginTop: 15,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  badgeText: {
    fontSize: 13,
    color: Global.AppTheme.light,
    marginLeft: 6,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  },
});

export default Card;
